<?php
/* Declaração de variáveis */
$a = 0.0;
$b = 0.0;
$c = 0.0;
$d = 0.0;
$e = 0.0;
$f = 0.0;
$g = 0.0;
$h = 0.0;

/* Declaração de função */
function um($a, $g, $d, $c) {
    $h = 0.0;
    $i = 0.0;
    $j = 0.0;
    $l = 0.0;

    $h = 2.0;
    $a = $g + 3.4 / $h;
    $l = $c - $d * 2;

    if (($c + $d) >= 5) {
        echo $a . PHP_EOL;
    } else {
        echo $l . PHP_EOL;
    }
}

function dois($j, $k, $l) {
    $cont = 0.0;
    $quant = 0.0;

    $quant = floatval(readline());
    $cont = floatval(readline());

    while ($cont <= $quant) {
        echo $cont . PHP_EOL;
        $cont = $cont + 1;
    }

    $l = $l + $j + $cont;

    echo $k . PHP_EOL;
    echo $l . PHP_EOL;
}

/* Corpo principal */

echo $e . PHP_EOL; // real

$f = floatval(readline());
$g = floatval(readline());
$h = floatval(readline());

$d = $e / $f; // real

dois($h, $d, $h);
um($f, $e, $g, $h); // real, real, inteiro, inteiro

// Aqui termina o programa
?>
