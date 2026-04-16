// gsap-example.js

import { gsap } from 'gsap';

// Fade-in animation function for products
function fadeInProducts(products) {
    products.forEach(product => {
        gsap.from(product, { opacity: 0, duration: 1, ease: 'power2.out' });
    });
}

// Scroll effect for product reveal
function scrollRevealProducts(products) {
    const revealOptions = {
        threshold: 0.1 // Trigger when 10% of the element is in view
    };
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                gsap.to(entry.target, { opacity: 1, y: 0, duration: 1, ease: 'power2.out' });
                observer.unobserve(entry.target);
            }
        });
    }, revealOptions);

    products.forEach(product => {
        product.style.opacity = 0; // Initially hidden
        product.style.transform = 'translateY(100px)'; // Initial position
        observer.observe(product);
    });
}

// Hover interaction for product details
function setupHoverInteractions(products) {
    products.forEach(product => {
        product.addEventListener('mouseenter', () => {
            gsap.to(product, { scale: 1.05, duration: 0.3, ease: 'power1.out' });
        });
        product.addEventListener('mouseleave', () => {
            gsap.to(product, { scale: 1, duration: 0.3, ease: 'power1.out' });
        });
    });
}

// Example usage
const bikeProducts = document.querySelectorAll('.bike-product');
fadeInProducts(bikeProducts);
scrollRevealProducts(bikeProducts);
setupHoverInteractions(bikeProducts);

