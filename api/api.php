<?php
// ======================
// PHẦN NGĂN TRUY CẬP TRỰC TIẾP
// ======================
$direct_access_detected = false;

if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    // Đây là truy cập trực tiếp
    $direct_access_detected = true;
}

if ($direct_access_detected) {
    header('HTTP/1.1 403 Forbidden');
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>Truy cập bị từ chối</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 100px 20px; background: #111; color: #fff; }
        h1 { color: #ff3366; }
        p { font-size: 1.2em; max-width: 600px; margin: 20px auto; }
        a { color: #33ff99; text-decoration: none; }
    </style>
</head>
<body>
    <h1>Truy cập bị từ chối!</h1>
    <p>Vui lòng chạy từ trang web chính!<br>Không được truy cập trực tiếp file API này.</p>
    <p><a href="/">Quay về trang chủ</a></p>
</body>
</html>';
    exit;
}

// ======================
// PHẦN CODE API BÌNH THƯỜNG
// ======================

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Secret key Cloudflare Turnstile (đã cập nhật theo bạn cung cấp)
$turnstile_secret = '0x4AAAAAACfWnlQqmSpuw0vK99b4ctF7kVo';

function respond($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function verify_turnstile($token) {
    if (empty($token)) return false;

    $url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    $data = [
        'secret'   => $GLOBALS['turnstile_secret'],
        'response' => $token,
        'remoteip' => $_SERVER['REMOTE_ADDR'] ?? ''
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $result = curl_exec($ch);
    curl_close($ch);

    if (!$result) return false;

    $response = json_decode($result, true);
    return !empty($response['success']);
}

// Lấy token Turnstile từ request
$turnstile_token = $_GET['turnstile'] ?? $_POST['turnstile'] ?? '';

// Verify Turnstile trước khi xử lý bất kỳ logic nào
if (!verify_turnstile($turnstile_token)) {
    http_response_code(403);
    respond(['code' => -2, 'msg' => 'Turnstile verification failed - possible bot']);
}

// ────────────────────────────────────────────────
// Xử lý API tikwm (giữ nguyên phần còn lại)
function fetch_with_retry($url, $max_retries = 3, $delay = 3) {
    for ($i = 0; $i < $max_retries; $i++) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($http_code >= 200 && $http_code < 300 && $response) {
            return $response;
        }

        if ($i < $max_retries - 1) sleep($delay);
    }
    return false;
}

$input_url = $_GET['url'] ?? '';
$video_id  = $_GET['id']  ?? '';

if ($input_url) {
    $api_url = 'https://tikwm.com/api/?url=' . urlencode($input_url);
    $json = fetch_with_retry($api_url);

    if ($json === false) {
        respond(['code' => -1, 'msg' => 'Cannot reach tikwm API']);
    }

    $data = json_decode($json, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
        respond(['code' => -1, 'msg' => 'Invalid response from tikwm']);
    }

    respond($data);
}

if ($video_id) {
    $api_url = 'https://tikwm.com/api/?url=https://www.tiktok.com/@any/video/' . $video_id;
    $json = fetch_with_retry($api_url);

    if ($json === false) {
        respond(['code' => -1, 'msg' => 'Cannot reach tikwm stats API']);
    }

    $data = json_decode($json, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
        respond(['code' => -1, 'msg' => 'Invalid stats response']);
    }

    respond($data);
}

respond(['code' => -1, 'msg' => 'Missing required parameter']);
