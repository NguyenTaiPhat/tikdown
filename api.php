<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // cho phép gọi từ frontend cùng domain hoặc localhost

// Tắt hiển thị lỗi (production)
ini_set('display_errors', 0);
error_reporting(0);

function respond($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

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

        if ($i < $max_retries - 1) {
            sleep($delay);
        }
    }
    return false;
}

$input_url   = $_GET['url']   ?? '';
$video_id    = $_GET['id']    ?? '';

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
        respond(['code' => -1, 'msg' => 'Cannot reach tikwm API']);
    }

    $data = json_decode($json, true);

    if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
        respond(['code' => -1, 'msg' => 'Invalid stats response']);
    }

    respond($data);
}

// Không có tham số hợp lệ
respond(['code' => -1, 'msg' => 'Missing required parameter (url or id)']);