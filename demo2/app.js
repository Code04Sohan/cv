// Global Cart Array
let cart = [];

// Fetch and display products with Tailwind styling
async function loadProducts() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getProducts`);
        const result = await response.json();
        
        const grid = document.getElementById('product-grid');
        grid.innerHTML = ''; 

        if(result.success && result.data.length > 0) {
            result.data.forEach(product => {
                const card = document.createElement('div');
                card.className = 'bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col border border-gray-100 group';
                
                card.innerHTML = `
                    ${product.ImageURL 
                        ? `<div class="overflow-hidden"><img src="${product.ImageURL}" alt="${product.Name}" class="w-full h-56 object-cover transform transition duration-500 group-hover:scale-110"></div>` 
                        : '<div class="w-full h-56 bg-gray-200 flex items-center justify-center text-gray-400">No Image Available</div>'
                    }
                    <div class="p-5 flex flex-col flex-grow">
                        <h3 class="text-xl font-bold text-gray-800 mb-1">${product.Name}</h3>
                        <p class="text-gray-500 text-sm mb-4 line-clamp-2 flex-grow">${product.Description}</p>
                        
                        <div class="flex justify-between items-center mb-4">
                            <span class="text-2xl font-bold text-brand">₹${product.Price}</span>
                            <span class="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-600 rounded-full">Stock: ${product.Stock}</span>
                        </div>
                        
                        ${product.Stock > 0 ? `
                            <div class="flex gap-2">
                                <input type="number" id="qty-${product.ID}" value="1" min="1" max="${product.Stock}" class="w-16 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-brand outline-none text-center font-bold text-gray-700">
                                <button onclick="addToCart('${product.ID}', '${product.Name}', ${product.Price}, ${product.Stock})" class="flex-grow bg-gray-900 hover:bg-brand text-white font-bold py-2 rounded transition-colors duration-300">Add to Cart</button>
                            </div>
                        ` : '<div class="text-center py-2 bg-red-100 text-red-600 font-bold rounded">Out of Stock</div>'}
                    </div>
                `;
                grid.appendChild(card);
            });
        } else {
            grid.innerHTML = '<p class="col-span-full text-center text-gray-500 py-10 font-medium">No products available right now. Please check back later!</p>';
        }
    } catch (error) { 
        console.error("Error loading products:", error); 
        document.getElementById('product-grid').innerHTML = '<p class="col-span-full text-center text-red-500 py-10">Failed to load catalog. Please check your connection.</p>';
    }
}

// Add an item to the cart array
function addToCart(id, name, price, maxStock) {
    const qtyInput = document.getElementById(`qty-${id}`).value;
    const quantity = parseInt(qtyInput);
    
    if (quantity > maxStock) {
        return alert("Cannot add more than available stock!");
    }

    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
        if (existingItem.quantity + quantity > maxStock) {
            return alert("Exceeds total stock limits!");
        }
        existingItem.quantity += quantity;
    } else {
        cart.push({ id, name, price, quantity });
    }
    
    updateCartUI();
}

// Re-render the Cart UI with Tailwind styling
function updateCartUI() {
    const cartItemsDiv = document.getElementById('cart-items');
    cartItemsDiv.innerHTML = '';
    let total = 0;
    let count = 0;

    cart.forEach((item, index) => {
        total += (item.price * item.quantity);
        count += item.quantity;
        
        cartItemsDiv.innerHTML += `
            <div class="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200">
                <span class="font-medium text-gray-800">${item.name} <span class="text-gray-500 text-sm ml-2">x ${item.quantity}</span></span>
                <div class="flex items-center gap-4">
                    <span class="font-bold text-brand">₹${item.price * item.quantity}</span>
                    <button onclick="removeFromCart(${index})" class="text-red-500 hover:text-white bg-red-50 hover:bg-red-500 px-2 py-1 rounded transition-colors" title="Remove Item">✕</button>
                </div>
            </div>
        `;
    });

    document.getElementById('cart-total').innerText = total;
    document.getElementById('cart-count').innerText = count;
    
    // Enable or disable the checkout button based on cart contents
    const checkoutBtn = document.getElementById('checkout-btn');
    if (cart.length === 0) {
        checkoutBtn.disabled = true;
        checkoutBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        checkoutBtn.disabled = false;
        checkoutBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

// Remove an item from the cart
function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

// Handle Order Submission
document.getElementById('order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (cart.length === 0) {
        return alert("Your cart is empty!");
    }

    const checkoutBtn = document.getElementById('checkout-btn');
    const originalBtnText = checkoutBtn.innerText;
    checkoutBtn.innerText = "Processing Order...";
    checkoutBtn.disabled = true;

    // Build the payload matching the new Google Apps Script configuration
    const payload = {
        name: document.getElementById('cust-name').value,
        phone: document.getElementById('cust-phone').value,
        email: document.getElementById('cust-email').value, // Email for auto-receipts
        address: document.getElementById('cust-address').value,
        cart: cart,
        total: document.getElementById('cart-total').innerText
    };

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'addOrder', payload: payload })
        });
        
        const result = await response.json();
        if(result.success) {
            alert(`🎉 Order Placed Successfully!\nYour Order ID is: ${result.orderId}\nA confirmation email has been sent to ${payload.email}.`);
            
            // Reset everything after successful order
            cart = [];
            updateCartUI();
            document.getElementById('order-form').reset();
            loadProducts(); // Refresh stock immediately
        } else {
            alert("There was an issue placing your order. Please try again.");
        }
    } catch (error) { 
        alert("Failed to connect to the server. Please check your internet connection.");
        console.error(error);
    } finally {
        // Restore button state
        checkoutBtn.innerText = originalBtnText;
        if(cart.length > 0) checkoutBtn.disabled = false;
    }
});

// Initialize the catalog on first load
loadProducts();

// Dynamic Polling: Refresh product catalog automatically every 30 seconds
// NOTE: We only fetch if the cart is empty so we don't overwrite the stock 
// a user is currently looking at while building their order.
setInterval(() => {
    if(cart.length === 0) {
        loadProducts();
    }
}, 30000);