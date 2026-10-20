<?php

use Illuminate\Support\Facades\Route;

// The 404 page as a normal route, so the static site generator can render it.
// GitHub Pages serves it as 404.html (see .github/workflows/deploy.yml).
Route::statamic('not-found', 'errors.404', [
    'title' => 'Page not found',
]);
