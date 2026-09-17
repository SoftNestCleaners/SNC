<?php
/**
 * SoftNest Cleaners — configuration
 *
 * 1. In Telegram, message @BotFather → /newbot → copy the token.
 * 2. Message @userinfobot → copy your numeric Id (that is your chat id).
 *    For a group: add the bot to the group, then use @getidsbot to get the
 *    group id (it starts with a minus sign).
 * 3. Fill both values below, save, upload.
 * 4. Send a test request through the form on the site.
 */

define('TELEGRAM_BOT_TOKEN', 'YOUR_BOT_TOKEN_HERE');
define('TELEGRAM_CHAT_ID',   'YOUR_CHAT_ID_HERE');

// Email backup. Leave as-is to disable.
define('ADMIN_EMAIL', 'softnestcleaners@gmail.com');

// Sender address for the backup email. Use an address on YOUR domain,
// otherwise most providers will drop the message as spoofed.
define('MAIL_FROM', 'noreply@softnestcleaners.com');
