<?php
/**
 * SoftNest Cleaners — quote form handler
 * Sends submissions to Telegram, with email + local log as backup.
 */

header('Content-Type: application/json; charset=utf-8');

// Same-origin only. If the form ever lives on another domain, list it here.
// (Wildcard CORS was removed on purpose — it let anyone POST to this endpoint.)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/config.php';

/* ------------------------------------------------------------------
   Fallback log — written whenever Telegram AND email both fail, so a
   lead is never lost to a typo in the bot token.
------------------------------------------------------------------ */
function write_fallback_log(array $row) {
    $file = __DIR__ . '/leads-fallback.csv';
    $new  = !file_exists($file);
    if ($fh = @fopen($file, 'a')) {
        if (flock($fh, LOCK_EX)) {
            if ($new) fputcsv($fh, ['received_at','first_name','last_name','phone','email','zip','service','date','message']);
            fputcsv($fh, $row);
            flock($fh, LOCK_UN);
        }
        fclose($fh);
    }
}

/* ------------------------------------------------------------------
   Anti-spam
------------------------------------------------------------------ */

// 1. Honeypot: a field humans never see. Bots fill it in.
if (!empty($_POST['website'])) {
    http_response_code(200);           // pretend it worked; don't teach the bot
    echo json_encode(['ok' => true]);
    exit;
}

// 2. Simple per-IP rate limit: max 5 submissions per hour.
$ip      = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rlFile  = sys_get_temp_dir() . '/softnest_rl_' . md5($ip);
$now     = time();
$hits    = [];
if (is_readable($rlFile)) {
    $hits = array_filter((array) json_decode(@file_get_contents($rlFile), true),
                         function ($t) use ($now) { return $t > $now - 3600; });
}
if (count($hits) >= 5) {
    http_response_code(429);
    echo json_encode(['ok' => false, 'error' => 'Too many requests. Please call us instead.']);
    exit;
}
$hits[] = $now;
@file_put_contents($rlFile, json_encode(array_values($hits)));

/* ------------------------------------------------------------------
   Validation
------------------------------------------------------------------ */
$required = ['firstName', 'lastName', 'phone', 'email', 'zip', 'service'];
foreach ($required as $field) {
    if (empty($_POST[$field])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => "Field '$field' is required"]);
        exit;
    }
}

$emailRaw = trim($_POST['email']);
if (!filter_var($emailRaw, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Please enter a valid email address']);
    exit;
}

$zipRaw = trim($_POST['zip']);
if (!preg_match('/^\d{5}(-\d{4})?$/', $zipRaw)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Please enter a valid ZIP code']);
    exit;
}

$cap = function ($s, $n) { return mb_substr(trim($s), 0, $n); };

$firstName = htmlspecialchars($cap($_POST['firstName'], 60), ENT_QUOTES, 'UTF-8');
$lastName  = htmlspecialchars($cap($_POST['lastName'], 60), ENT_QUOTES, 'UTF-8');
$phone     = htmlspecialchars($cap($_POST['phone'], 30), ENT_QUOTES, 'UTF-8');
$email     = htmlspecialchars($emailRaw, ENT_QUOTES, 'UTF-8');
$zip       = htmlspecialchars($zipRaw, ENT_QUOTES, 'UTF-8');
$service   = htmlspecialchars($cap($_POST['service'], 40), ENT_QUOTES, 'UTF-8');
$date      = !empty($_POST['date'])    ? htmlspecialchars($cap($_POST['date'], 20), ENT_QUOTES, 'UTF-8')     : 'Not specified';
$message   = !empty($_POST['message']) ? htmlspecialchars($cap($_POST['message'], 2000), ENT_QUOTES, 'UTF-8') : 'No message';

$services = [
    'upholstery' => 'Upholstery Cleaning',
    'carpet'     => 'Carpet Cleaning',
    'rug'        => 'Area Rug Cleaning',
    'mattress'   => 'Mattress Cleaning',
    'car'        => 'Car Interior Cleaning',
    'other'      => 'Other',
];
$serviceName = $services[$service] ?? $service;

/* ------------------------------------------------------------------
   Compose
------------------------------------------------------------------ */
$text  = "🆕 <b>NEW SOFTNEST LEAD</b>\n\n";
$text .= "👤 <b>Name:</b> {$firstName} {$lastName}\n";
$text .= "📞 <b>Phone:</b> {$phone}\n";
$text .= "📧 <b>Email:</b> {$email}\n";
$text .= "📍 <b>ZIP:</b> {$zip}\n\n";
$text .= "🛠 <b>Service:</b> {$serviceName}\n";
$text .= "📅 <b>Preferred date:</b> {$date}\n\n";
$text .= "📝 <b>Message:</b>\n{$message}";

$logRow = [date('c'), $firstName, $lastName, $phone, $email, $zip, $serviceName, $date, $message];

/* ------------------------------------------------------------------
   Telegram
------------------------------------------------------------------ */
$telegramOk = false;
$configured = defined('TELEGRAM_BOT_TOKEN') && TELEGRAM_BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE'
           && defined('TELEGRAM_CHAT_ID')   && TELEGRAM_CHAT_ID   !== 'YOUR_CHAT_ID_HERE';

if ($configured) {
    $ch = curl_init('https://api.telegram.org/bot' . TELEGRAM_BOT_TOKEN . '/sendMessage');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query([
            'chat_id'    => TELEGRAM_CHAT_ID,
            'text'       => $text,
            'parse_mode' => 'HTML',
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $telegramOk = ($httpCode === 200 && $response);

    // Photos: capped at 5 so one request can't tie up the script.
    $photoCount = 0;
    if ($telegramOk && !empty($_FILES['photos']) && is_array($_FILES['photos']['tmp_name'])) {
        foreach ($_FILES['photos']['tmp_name'] as $i => $tmp) {
            if ($photoCount >= 5) break;
            if ($_FILES['photos']['error'][$i] !== UPLOAD_ERR_OK || !is_uploaded_file($tmp)) continue;
            if ($_FILES['photos']['size'][$i] > 5 * 1024 * 1024) continue;

            $info = @getimagesize($tmp);
            if ($info === false) continue;             // not an image — skip it

            $chP = curl_init('https://api.telegram.org/bot' . TELEGRAM_BOT_TOKEN . '/sendPhoto');
            curl_setopt_array($chP, [
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => [
                    'chat_id' => TELEGRAM_CHAT_ID,
                    'caption' => $photoCount === 0 ? "📎 Photos from {$firstName} {$lastName}" : '',
                    'photo'   => new CURLFile($tmp, $info['mime'], 'photo' . $i . '.jpg'),
                ],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 30,
            ]);
            curl_exec($chP);
            curl_close($chP);
            $photoCount++;
        }
    }
}

/* ------------------------------------------------------------------
   Email backup
------------------------------------------------------------------ */
$mailOk = false;
if (defined('ADMIN_EMAIL') && filter_var(ADMIN_EMAIL, FILTER_VALIDATE_EMAIL)) {
    $body    = html_entity_decode(strip_tags(str_replace(['<b>', '</b>'], '', $text)), ENT_QUOTES, 'UTF-8');
    $headers = "From: " . MAIL_FROM . "\r\n";
    $headers .= "Reply-To: " . $emailRaw . "\r\n";       // reply goes straight to the customer
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $mailOk = @mail(ADMIN_EMAIL, "New quote request — {$firstName} {$lastName}", $body, $headers);
}

/* ------------------------------------------------------------------
   Respond honestly
------------------------------------------------------------------ */
if ($telegramOk || $mailOk) {
    http_response_code(200);
    echo json_encode(['ok' => true, 'message' => 'Quote request received']);
} else {
    write_fallback_log($logRow);                        // don't lose the lead
    error_log('SoftNest: lead delivery failed, written to leads-fallback.csv');
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Delivery failed']);
}
