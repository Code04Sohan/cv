// Global State for Notifications
let currentOrderCount = 0;
let isFirstLoad = true;

// ==========================================
// 1. ADD NEW PRODUCT LOGIC
// ==========================================
document.getElementById('add-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Change button text to show activity
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "Adding...";
    submitBtn.disabled = true;

    const payload = {
        name: document.getElementById('prod-name').value, 
        description: document.getElementById('prod-desc').value,
        price: document.getElementById('prod-price').value, 
        imageUrl: document.getElementById('prod-img').value,
        stock: document.getElementById('prod-stock').value
    };
    
    await sendPostRequest('addProduct', payload);
    
    // Reset form and reload
    document.getElementById('add-product-form').reset();
    submitBtn.innerText = originalText;
    submitBtn.disabled = false;
    loadAdminProducts();
});

// ==========================================
// 2. MANAGE INVENTORY (LOAD, EDIT, DELETE)
// ==========================================
async function loadAdminProducts() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getProducts`);
        const result = await response.json();
        const list = document.getElementById('admin-product-list');
        list.innerHTML = ''; 

        if(result.success && result.data.length > 0) {
            result.data.forEach(p => {
                // Tailwind Styled Inventory Card
                list.innerHTML += `
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col justify-between hover:shadow-md transition">
                        <div class="flex gap-4 mb-4">
                            ${p.ImageURL 
                                ? `<img src="${p.ImageURL}" class="w-16 h-16 object-cover rounded shadow-sm border border-gray-200">` 
                                : `<div class="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400 border border-gray-300">No Img</div>`
                            }
                            <div>
                                <h4 class="font-bold text-gray-800">${p.Name}</h4>
                                <p class="text-brand font-bold text-sm">₹${p.Price}</p>
                                <p class="text-xs text-gray-500 mt-1">Stock: <span class="font-bold text-gray-700">${p.Stock}</span></p>
                            </div>
                        </div>
                        <div class="flex gap-2 text-sm">
                            <button onclick="openEditModal('${p.ID}', '${encodeURIComponent(p.Name)}', '${encodeURIComponent(p.Description)}', ${p.Price}, '${encodeURIComponent(p.ImageURL)}', ${p.Stock})" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 rounded transition">Edit</button>
                            <button onclick="deleteProduct('${p.ID}')" class="flex-1 bg-red-100 hover:bg-red-500 hover:text-white text-red-600 font-bold py-2 rounded transition">Delete</button>
                        </div>
                    </div>`;
            });
        } else {
            list.innerHTML = '<p class="col-span-full text-gray-500">Your catalog is currently empty.</p>';
        }
    } catch (error) {
        console.error("Failed to load products:", error);
    }
}

// Edit Modal Functions
function openEditModal(id, name, desc, price, img, stock) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-name').value = decodeURIComponent(name);
    document.getElementById('edit-desc').value = decodeURIComponent(desc);
    document.getElementById('edit-price').value = price;
    document.getElementById('edit-img').value = decodeURIComponent(img === 'undefined' ? '' : img);
    document.getElementById('edit-stock').value = stock;
    
    const modal = document.getElementById('edit-modal');
    modal.style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

// Submit Edits
document.getElementById('edit-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        id: document.getElementById('edit-id').value,
        name: document.getElementById('edit-name').value,
        description: document.getElementById('edit-desc').value,
        price: document.getElementById('edit-price').value,
        imageUrl: document.getElementById('edit-img').value,
        stock: document.getElementById('edit-stock').value
    };
    await sendPostRequest('updateProduct', payload);
    closeEditModal();
    loadAdminProducts();
});

// Delete Product
async function deleteProduct(id) {
    if(confirm("Are you sure you want to permanently delete this product?")) {
        await sendPostRequest('deleteProduct', { id });
        loadAdminProducts();
    }
}

// ==========================================
// 3. ORDER MANAGEMENT & NOTIFICATIONS
// ==========================================
async function loadOrders() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getOrders`);
        const result = await response.json();
        const list = document.getElementById('orders-list');
        
        if(result.success && result.data.length > 0) {
            
            // Trigger Notification if new order arrived (and it's not the initial page load)
            if (!isFirstLoad && result.data.length > currentOrderCount) {
                if (typeof triggerNotification === "function") {
                    triggerNotification();
                }
            }
            currentOrderCount = result.data.length;
            isFirstLoad = false;

            list.innerHTML = ''; 
            
            // Reverse array to show newest orders at the top
            result.data.reverse().forEach(o => {
                const isPending = o.Status === 'Pending';
                
                // Tailwind Styled Order Card
                list.innerHTML += `
                    <div class="bg-white border-l-4 ${isPending ? 'border-orange-400' : 'border-green-500'} rounded shadow-sm p-4 mb-3">
                        <div class="flex justify-between items-start mb-2 border-b pb-2">
                            <div>
                                <span class="text-xs font-bold text-gray-500">ORDER ID: ${o.OrderID}</span>
                                <h4 class="font-bold text-gray-800">${o.CustomerName}</h4>
                            </div>
                            <span class="text-xs font-bold px-2 py-1 rounded ${isPending ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'} uppercase tracking-wide">
                                ${o.Status}
                            </span>
                        </div>
                        
                        <div class="text-sm text-gray-600 mb-3 space-y-1">
                            <p>📞 ${o.Phone} | ✉️ ${o.Email}</p>
                            <p>📍 ${o.Address}</p>
                        </div>
                        
                        <div class="bg-gray-50 p-2 rounded text-sm font-mono text-gray-700 mb-3 overflow-x-auto">
                            ${formatCartDetails(o.OrderDetails)}
                        </div>
                        
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-lg text-brand">₹${o.TotalAmount}</span>
                            ${isPending ? `<button onclick="markProcessed('${o.OrderID}')" class="bg-green-500 hover:bg-green-600 text-white text-sm font-bold py-2 px-4 rounded transition shadow">Mark Processed</button>` : '<span class="text-green-500 text-sm font-bold flex items-center gap-1"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg> Completed</span>'}
                        </div>
                    </div>`;
            });
        } else {
            list.innerHTML = '<p class="text-gray-500 p-4 text-center bg-gray-50 rounded border border-dashed">No orders have been placed yet.</p>';
            isFirstLoad = false;
        }
    } catch (error) {
        console.error("Failed to load orders:", error);
    }
}

// Helper to format the JSON string of cart details into readable text
function formatCartDetails(cartString) {
    try {
        const cartArr = JSON.parse(cartString);
        return cartArr.map(item => `${item.quantity}x ${item.name}`).join('<br>');
    } catch {
        return cartString; // Fallback if parsing fails
    }
}

// Update order status
async function markProcessed(orderId) {
    if(confirm("Mark this order as Processed? This action cannot be undone.")) {
        await sendPostRequest('updateOrderStatus', { orderId: orderId, status: 'Processed' });
        loadOrders();
    }
}

// ==========================================
// 4. API COMMUNICATION HELPER
// ==========================================
async function sendPostRequest(action, payload) {
    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST', 
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: action, payload: payload })
        });
        const result = await response.json();
        
        if(!result.success) {
            alert("Error: " + result.message);
        }
        return result;
    } catch (error) { 
        console.error(error); 
        alert("Network Error. Could not communicate with the database."); 
        return { success: false };
    }
}

// ==========================================
// 5. INITIALIZATION & POLLING
// ==========================================
loadAdminProducts();
loadOrders();

// Refresh the orders list silently every 15 seconds
setInterval(loadOrders, 15000);