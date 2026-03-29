// ====== SUPABASE SETUP ======
// ⚠️ ATENCIÓN: Por favor, reemplaza la siguiente URL con la "Project URL" de tu panel de Supabase.
// La puedes encontrar en: Project Settings -> API. (Ej. https://abcdefghij.supabase.co)
const supabaseUrl = 'https://qcgkihvbkgvnzpdprcfv.supabase.co'; 
const supabaseKey = 'sb_publishable_42mWfuetvLphAUl6tl0saA_el2rUIM4';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// ====== STATE ======
let transactions = [];

// ====== DOM ELEMENTS ======
const totalBalanceEl = document.getElementById('total-balance');
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const transactionListEl = document.getElementById('transaction-list');
const transactionModal = document.getElementById('transaction-modal');
const addTransactionBtn = document.getElementById('add-transaction-btn');
const closeModalBtn = document.getElementById('close-modal');
const transactionForm = document.getElementById('transaction-form');
const submitBtn = document.getElementById('submit-btn-text');

// Categorias dinamicas
const typeRadios = document.querySelectorAll('input[name="type"]');
const incomeCategories = document.getElementById('income-categories');
const expenseCategories = document.getElementById('expense-categories');
const categorySelect = document.getElementById('category');

// ====== INITIALIZATION ======
document.addEventListener('DOMContentLoaded', () => {
    // Set default date to today
    document.getElementById('date').valueAsDate = new Date();
    
    // Setup Chart
    initChart();
    
    // Load Data from Supabase
    loadData();
});

// ====== API & STORAGE ======
async function loadData() {
    try {
        // Obtenemos los datos de Supabase ordenados por los más recientes
        const { data, error } = await _supabase
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            // Si hay un error (ej. la tabla no existe o la URL es invalida)
            throw error;
        }
        
        transactions = data || [];
        updateUI();
        
    } catch (err) {
        console.error('Error cargando datos de Supabase:', err.message);
        showToast('Debes configurar tu URL de Supabase.', 'error');
        
        // Fallback a LocalStorage para que la app no se rompa visualmente
        const stored = localStorage.getItem('finance_transactions');
        if (stored) {
            transactions = JSON.parse(stored);
        } else {
            transactions = [];
        }
        updateUI();
    }
}

// ====== UI UPDATES ======
function updateUI() {
    const income = transactions
        .filter(t => t.type === 'ingreso')
        .reduce((acc, t) => acc + Number(t.amount), 0);
        
    const expense = transactions
        .filter(t => t.type === 'gasto')
        .reduce((acc, t) => acc + Number(t.amount), 0);
        
    const balance = income - expense;
    
    // Update text
    totalBalanceEl.innerText = formatMoney(balance);
    totalIncomeEl.innerText = formatMoney(income);
    totalExpenseEl.innerText = formatMoney(expense);
    
    // Render list
    renderTransactions();
    
    // Update chart
    updateChart(income, expense);
}

function renderTransactions() {
    transactionListEl.innerHTML = '';
    
    if (transactions.length === 0) {
        transactionListEl.innerHTML = '<div class="no-data">No hay movimientos registrados.</div>';
        return;
    }
    
    // Sort by date descending (to ensure UI exactness)
    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sorted.forEach(t => {
        const item = document.createElement('div');
        item.classList.add('transaction-item');
        
        const isIncome = t.type === 'ingreso';
        const iconClass = isIncome ? 'fa-arrow-down' : 'fa-arrow-up';
        
        item.innerHTML = `
            <div class="trans-info">
                <div class="trans-icon ${t.type}">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="trans-details">
                    <h4>${t.description}</h4>
                    <p>${t.category} • ${formatDate(t.date)}</p>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap: 1rem;">
                <div class="trans-amount ${t.type}">
                    ${isIncome ? '+' : '-'}${formatMoney(t.amount)}
                </div>
                <button class="delete-btn" onclick="deleteTransaction('${t.id}')" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        transactionListEl.appendChild(item);
    });
}

// ====== ACTIONS ======
async function addTransaction(e) {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    
    const type = document.querySelector('input[name="type"]:checked').value;
    const amount = document.getElementById('amount').value;
    const category = document.getElementById('category').value;
    const description = document.getElementById('description').value;
    const date = document.getElementById('date').value;
    
    if(!category) {
        showToast('Por favor selecciona una categoría', 'error');
        resetBtn();
        return;
    }

    const newTransaction = {
        type,
        amount: Number(amount),
        category,
        description,
        date
    };
    
    try {
        // Enviar a Supabase
        const { data, error } = await _supabase
            .from('transactions')
            .insert([newTransaction])
            .select();

        if (error) throw error;
        
        // Insertar en UI local
        if (data && data.length > 0) {
            transactions.unshift(data[0]); 
        } else {
            // Fallback si no refresca data
            transactions.unshift({ id: Date.now().toString(), ...newTransaction });
        }
        
        // Respaldo en LocalStorage
        localStorage.setItem('finance_transactions', JSON.stringify(transactions));
        
        updateUI();
        closeModal();
        transactionForm.reset();
        document.getElementById('date').valueAsDate = new Date();
        
        // Reset categories selection visibility
        document.getElementById('type-income').checked = true;
        incomeCategories.style.display = 'block';
        expenseCategories.style.display = 'none';

        showToast('Transacción guardada correctamente', 'success');
    } catch (err) {
        console.error('Error guardando en base de datos:', err);
        showToast('Error al guardar en la nube. Verifica tu URL de Supabase.', 'error');
    } finally {
        resetBtn();
    }
}

window.deleteTransaction = async function(id) {
    if(confirm('¿Estás seguro de eliminar este movimiento de la base de datos?')) {
        try {
            // Eliminar de base de datos
            const { error } = await _supabase
                .from('transactions')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            
            // Eliminar UI local
            transactions = transactions.filter(t => t.id !== id);
            localStorage.setItem('finance_transactions', JSON.stringify(transactions));
            
            updateUI();
            showToast('Transacción eliminada de la nube', 'success');
            
        } catch(err) {
            console.error('Error eliminando de base de datos:', err);
            showToast('No se pudo eliminar de la base de datos.', 'error');
        }
    }
}

function resetBtn() {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>Guardar Transacción</span>';
}

// ====== EVENT LISTENERS ======
addTransactionBtn.addEventListener('click', () => {
    transactionModal.classList.add('active');
});

closeModalBtn.addEventListener('click', closeModal);

// Close modal on outside click
transactionModal.addEventListener('click', (e) => {
    if (e.target === transactionModal) {
        closeModal();
    }
});

function closeModal() {
    transactionModal.classList.remove('active');
}

transactionForm.addEventListener('submit', addTransaction);

// Type toggle logic (show/hide categories)
typeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        categorySelect.value = ''; // Reset selection
        if (e.target.value === 'ingreso') {
            incomeCategories.style.display = 'block';
            expenseCategories.style.display = 'none';
        } else {
            incomeCategories.style.display = 'none';
            expenseCategories.style.display = 'block';
        }
    });
});

// ====== UTILS ======
function formatMoney(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN' // Change this if needed
    }).format(amount);
}

function formatDate(dateStr) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', options);
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ====== CHART ======
let financeChart;

function initChart() {
    const ctx = document.getElementById('financeChart').getContext('2d');
    Chart.defaults.color = '#94a3b8';
    
    financeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Ingresos', 'Gastos'],
            datasets: [{
                data: [0, 0],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)', // Income
                    'rgba(239, 68, 68, 0.8)'   // Expense
                ],
                borderColor: ['#10b981', '#ef4444'],
                borderWidth: 1,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            },
            cutout: '70%'
        }
    });
}

function updateChart(income, expense) {
    if (financeChart) {
        financeChart.data.datasets[0].data = [income, expense];
        financeChart.update();
    }
}

// ====== PWA SERVICE WORKER ======
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado con éxito.', reg.scope))
            .catch(err => console.error('Error al registrar el Service Worker:', err));
    });
}
