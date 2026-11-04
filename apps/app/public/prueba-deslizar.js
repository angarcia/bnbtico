// Como React en la app: un oyente de touchstart en el documento hace que iPhone aplique :active (el encogerse al tocar).
document.addEventListener("touchstart", function () {}, { passive: true });
