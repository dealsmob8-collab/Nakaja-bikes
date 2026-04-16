import products from './products.js';
import { gsap } from 'gsap';

const showcase = document.getElementById('showcase');

function loadBikeProducts() {
    products.forEach(product => {
        const productElement = document.createElement('div');
        productElement.className = 'product';
        productElement.innerHTML = `<h2>${product.name}</h2><p>${product.description}</p><span>$${product.price}</span>`;

        // GSAP animations for fade-in and scroll reveal
        gsap.from(productElement, { opacity: 0, duration: 1, scrollTrigger: { trigger: productElement, start: "top 80%" }});

        // Hover effect
        productElement.onmouseenter = () => {
            gsap.to(productElement, { scale: 1.05, duration: 0.3 });
        };
        productElement.onmouseleave = () => {
            gsap.to(productElement, { scale: 1, duration: 0.3 });
        };

        showcase.appendChild(productElement);
    });
}

// Load bike products on page load
window.onload = loadBikeProducts;