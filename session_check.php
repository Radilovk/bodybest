<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
if (isset($_SESSION['isAdmin']) && $_SESSION['isAdmin'] === true) {
    echo json_encode(["success" => true]);
} else {
    echo json_encode(["success" => false, "message" => "Not logged in"]);
}
?>
