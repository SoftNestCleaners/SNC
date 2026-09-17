# PHP version (not used on Cloudflare Pages)

Kept in case you ever move to normal shared hosting with PHP.

To use it:
1. Copy `quote.php`, `config.php` and `.htaccess` into an `api/` folder at the site root.
2. Fill in `config.php`.
3. In `index.html`, change the form action from `/api/quote` back to `api/quote.php`.
4. Delete the `functions/` folder — it does nothing outside Cloudflare.

Requires PHP 7.0+ with cURL.
