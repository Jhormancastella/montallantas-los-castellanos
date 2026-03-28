/* ============================================
   MONTALLANTAS LOS CASTELLANOS - APLICACIÓN
   ============================================ */

// Configuración Firebase
const { db, storage, auth, fieldIncrement, mode: dataMode } = window.appServices;

// ============================================
// VARIABLES GLOBALES
// ============================================
let selectedInsumos = [];
let currentReportData = [];
let isLoggedIn = false;
let isAdminUser = false;

// ============================================
// AUTENTICACIÓN
// ============================================
const loginScreen = document.getElementById('loginScreen');
const mainContent = document.getElementById('mainContent');
const sidebar = document.getElementById('sidebar');

function setAdminUiLoggedIn(user) {
    isLoggedIn = true;
    const adminBtn = document.getElementById('adminLoginBtn');
    adminBtn.innerHTML = '<i class="fas fa-user-check"></i><span>Admin</span>';
    adminBtn.onclick = logout;

    document.getElementById('currentDateContainer').classList.remove('hidden');
    document.getElementById('userInfoContainer').classList.remove('hidden');

    if (user?.email) {
        document.getElementById('userName').textContent = user.email.split('@')[0];
        document.getElementById('userAvatar').textContent = user.email.substring(0, 2).toUpperCase();
    }
}

function setAdminUiLoggedOut() {
    isLoggedIn = false;
    isAdminUser = false;
    const adminBtn = document.getElementById('adminLoginBtn');
    adminBtn.innerHTML = '<i class="fas fa-user-shield"></i><span>AD</span>';
    adminBtn.onclick = showLoginModal;

    document.getElementById('currentDateContainer').classList.add('hidden');
    document.getElementById('userInfoContainer').classList.add('hidden');
}

async function validateAdminAccess() {
    isAdminUser = false;
    if (!auth || !db) return false;
    const user = auth.currentUser;
    if (!user) return false;

    if (dataMode === 'local') {
        isAdminUser = true;
        return true;
    }
    if (dataMode === 'supabase') {
        // En modo Firebase Auth + Supabase DB permitimos admin al usuario autenticado.
        isAdminUser = true;
        return true;
    }

    try {
        const adminDoc = await db.collection('admins').doc(user.uid).get();
        isAdminUser = adminDoc.exists && adminDoc.data()?.enabled === true;
        if (!isAdminUser) {
            showToast(`Usuario sin permisos de admin (uid: ${user.uid})`, 'error');
        }
        return isAdminUser;
    } catch (err) {
        showToast(`No se pudo validar admin (uid: ${user.uid}). Revisa reglas.`, 'error');
        console.error('validateAdminAccess error', err);
        return false;
    }
}

function requireAdminOrToast() {
    if (dataMode === 'local') return true;
    if (!auth?.currentUser) {
        showToast('Debes iniciar sesión para continuar', 'error');
        return false;
    }
    if (!isAdminUser) {
        showToast(`No autorizado (uid: ${auth.currentUser.uid})`, 'error');
        return false;
    }
    return true;
}

function initAuthListener() {
    if (!auth) return;

    // Asegura persistencia en el navegador (recarga no debe "cerrar sesión")
    // Nota: en algunos contextos (bloqueo de cookies/3rd party) puede fallar.
    try {
        auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
    } catch (_) {}

    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            setAdminUiLoggedOut();
            return;
        }

        setAdminUiLoggedIn(user);
        await validateAdminAccess();

        // Solo cargamos datos de Firestore cuando ya tengamos sesión (y idealmente admin)
        // Si no es admin, igual dejamos la UI logueada pero bloqueará acciones por requireAdminOrToast().
        loadDashboardData();
        loadPOSData();
        loadAdminData();
    });
}

// Mostrar modal de login
function showLoginModal() {
    loginScreen.classList.add('show');
    document.getElementById('loginEmail').focus();
}

// Ocultar modal de login
function hideLoginModal() {
    loginScreen.classList.remove('show');
    document.getElementById('loginError').classList.remove('show');
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
}

// Cerrar modal al hacer clic fuera del formulario
loginScreen.addEventListener('click', (e) => {
    if (e.target === loginScreen) {
        hideLoginModal();
    }
});

// Login con correo y contraseña
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        if (auth) {
            await auth.signInWithEmailAndPassword(email, password);
            errorDiv.classList.remove('show');
            hideLoginModal();

            const user = auth.currentUser;
            setAdminUiLoggedIn(user);
            
            await validateAdminAccess();
            showToast(`Sesión iniciada (uid: ${user?.uid || 'n/a'})`);
        } else {
            throw new Error('Firebase Auth no está disponible');
        }
    } catch (error) {
        let message = 'Error al iniciar sesión';
        if (error.code === 'auth/user-not-found') {
            message = 'Usuario no encontrado';
        } else if (error.code === 'auth/wrong-password') {
            message = 'Contraseña incorrecta';
        } else if (error.code === 'auth/invalid-email') {
            message = 'Correo inválido';
        }
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
    }
});

// Cerrar sesión
function logout() {
    if (auth) {
        auth.signOut().then(() => {
            setAdminUiLoggedOut();
            showToast('Sesión cerrada');
        });
    }
}

// ============================================
// FUNCIONES DE UI
// ============================================

// Actualizar fecha actual
function updateCurrentDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const today = new Date().toLocaleDateString('es-ES', options);
    document.getElementById('currentDate').textContent = today.charAt(0).toUpperCase() + today.slice(1);
}

// Toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
}

// Toggle mobile menu
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const icon = document.getElementById('mobileMenuIcon');
    
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('active');
    
    if (sidebar.classList.contains('mobile-open')) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
    } else {
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    }
}

// Mostrar sección activa
function showSection(id) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    // Actualizar navegación activa
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    event.target.closest('.nav-link')?.classList.add('active');
    
    // Cerrar menú móvil si está abierto
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
        document.getElementById('mobileMenuIcon').classList.remove('fa-times');
        document.getElementById('mobileMenuIcon').classList.add('fa-bars');
    }
    
    // Cargar datos según la sección
    if (id === 'posSection') loadPOSData();
    if (id === 'servicesSection' || id === 'employeesSection' || id === 'insumosSection') loadAdminData();
    if (id === 'ventaInsumosSection') loadVentaInsumosData();
    if (id === 'prestamosSection') loadPrestamosData();
    if (id === 'dashboardSection') loadDashboardData();
}

// ============================================
// CARGA DE DATOS DEL DASHBOARD
// ============================================
function loadDashboardData() {
    const today = new Date().toISOString().split('T')[0];
    
    // Ventas de hoy
    db.collection('servicios_realizados').where('fecha', '==', today).get().then(snap => {
        let total = 0;
        snap.forEach(doc => {
            total += doc.data().totalCobrado || 0;
        });
        document.getElementById('statVentasHoy').textContent = formatCOP(total);
        document.getElementById('statServiciosHoy').textContent = snap.size;
        
        // Actividad reciente
        const activityContainer = document.getElementById('recentActivity');
        if (snap.size > 0) {
            activityContainer.innerHTML = '';
            snap.forEach(doc => {
                const data = doc.data();
                activityContainer.innerHTML += `
                    <div class="list-item">
                        <div class="list-item-info">
                            <div class="list-item-icon">
                                <i class="fas fa-receipt"></i>
                            </div>
                            <div class="list-item-text">
                                <h4>${data.cliente || 'Sin nombre'}</h4>
                                <p>${data.hora} - ${formatCOP(data.totalCobrado)}</p>
                            </div>
                        </div>
                        <span class="badge badge-success">Completado</span>
                    </div>
                `;
            });
        }
    });
    
    // Contar empleados
    db.collection('empleados').get().then(snap => {
        document.getElementById('statEmpleados').textContent = snap.size;
    });
    
    // Contar insumos
    db.collection('insumos').get().then(snap => {
        document.getElementById('statInsumos').textContent = snap.size;
    });
}

// ============================================
// CARGA DE DATOS
// ============================================
function loadPOSData() {
    // Cargar empleados
    db.collection('empleados').get().then(snap => {
        const select = document.getElementById('posEmployee');
        select.innerHTML = '<option value="">Seleccionar empleado...</option>';
        snap.forEach(doc => {
            const emp = doc.data();
            select.innerHTML += `<option value="${doc.id}" data-commission="${emp.comision}">${emp.nombre}</option>`;
        });
    });

    // Cargar servicios
    db.collection('servicios').get().then(snap => {
        const select = document.getElementById('posService');
        select.innerHTML = '<option value="">Seleccionar servicio...</option>';
        snap.forEach(doc => {
            const serv = doc.data();
            select.innerHTML += `<option value="${doc.id}" data-price="${serv.precio}">${serv.nombre}</option>`;
        });
    });

    // Cargar insumos para selección
    db.collection('insumos').get().then(snap => {
        const select = document.getElementById('posInsumoSelect');
        select.innerHTML = '<option value="">Seleccionar insumo...</option>';
        snap.forEach(doc => {
            const ins = doc.data();
            select.innerHTML += `<option value="${doc.id}" data-name="${ins.nombre}" data-price="${ins.precio}" data-stock="${ins.stock}">${ins.nombre} (Stock: ${ins.stock})</option>`;
        });
    });
}

function updateServicePrice() {
    const select = document.getElementById('posService');
    const price = parseFloat(select.options[select.selectedIndex].dataset.price) || 0;
    document.getElementById('servicePrice').innerHTML = `<i class="fas fa-tag"></i> Precio: ${formatCOP(price)}`;
    calculateSummary();
}

function loadAdminData() {
    // Cargar servicios
    db.collection('servicios').get().then(snap => {
        const list = document.getElementById('servicesList');
        if (snap.size === 0) {
            list.innerHTML = `<div class="empty-state"><i class="fas fa-tools"></i><p>No hay servicios registrados</p></div>`;
            return;
        }
        list.innerHTML = '';
        snap.forEach(doc => {
            const serv = doc.data();
            list.innerHTML += `
                <div class="list-item">
                    <div class="list-item-info">
                        <div class="list-item-icon">
                            <i class="fas fa-wrench"></i>
                        </div>
                        <div class="list-item-text">
                            <h4>${serv.nombre}</h4>
                            <p>$${serv.precio.toLocaleString()}</p>
                        </div>
                    </div>
                    <div class="list-item-actions">
                        <button class="btn btn-warning btn-sm" onclick="editService('${doc.id}', '${serv.nombre}', ${serv.precio})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteService('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    });

    // Cargar empleados
    db.collection('empleados').get().then(snap => {
        const list = document.getElementById('employeesList');
        if (snap.size === 0) {
            list.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><p>No hay empleados registrados</p></div>`;
            return;
        }
        list.innerHTML = '';
        snap.forEach(doc => {
            const emp = doc.data();
            list.innerHTML += `
                <div class="list-item">
                    <div class="list-item-info">
                        <div class="list-item-icon">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="list-item-text">
                            <h4>${emp.nombre}</h4>
                            <p>Comisión: ${emp.comision}%</p>
                        </div>
                    </div>
                    <div class="list-item-actions">
                        <button class="btn btn-warning btn-sm" onclick="editEmployee('${doc.id}', '${emp.nombre}', ${emp.comision})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteEmployee('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    });

    // Cargar insumos
    db.collection('insumos').get().then(snap => {
        const list = document.getElementById('insumosList');
        if (snap.size === 0) {
            list.innerHTML = `<div class="empty-state"><i class="fas fa-boxes"></i><p>No hay insumos registrados</p></div>`;
            return;
        }
        list.innerHTML = '';
        snap.forEach(doc => {
            const ins = doc.data();
            const stockClass = ins.stock < 10 ? 'badge-warning' : 'badge-success';
            list.innerHTML += `
                <div class="list-item">
                    <div class="list-item-info">
                        <div class="list-item-icon">
                            <i class="fas fa-box"></i>
                        </div>
                        <div class="list-item-text">
                            <h4>${ins.nombre}</h4>
                            <p>${ins.categoria} - $${ins.precio.toLocaleString()}</p>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span class="badge ${stockClass}">Stock: ${ins.stock}</span>
                        <div class="list-item-actions">
                            <button class="btn btn-warning btn-sm" onclick="editInsumo('${doc.id}', '${ins.nombre}', '${ins.categoria}', ${ins.precio}, ${ins.stock})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="deleteInsumo('${doc.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
    });
}

// ============================================
// GESTIÓN DE SERVICIOS (ADMIN)
// ============================================
function addService() {
    if (!requireAdminOrToast()) return;
    const name = document.getElementById('serviceName').value.trim();
    const price = parseInt(document.getElementById('servicePriceInput').value);
    if (name && price) {
        db.collection('servicios').add({ nombre: name, precio: price })
            .then(() => { 
                loadAdminData(); 
                clearServiceForm();
                showToast('Servicio agregado correctamente');
            })
            .catch(err => showToast('Error: ' + err, 'error'));
    } else {
        showToast('Completa todos los campos', 'error');
    }
}

function editService(id, name, price) {
    if (!requireAdminOrToast()) return;
    document.getElementById('serviceName').value = name;
    document.getElementById('servicePriceInput').value = price;
    
    // Scroll al formulario
    document.querySelector('#servicesSection .card').scrollIntoView({ behavior: 'smooth' });
    
    // Cambiar botón
    const saveBtn = document.querySelector('#servicesSection .btn-success');
    saveBtn.innerHTML = '<i class="fas fa-edit"></i> Actualizar Servicio';
    saveBtn.onclick = () => {
        const newName = document.getElementById('serviceName').value.trim();
        const newPrice = parseInt(document.getElementById('servicePriceInput').value);
        db.collection('servicios').doc(id).update({ nombre: newName, precio: newPrice })
            .then(() => { 
                loadAdminData(); 
                clearServiceForm();
                showToast('Servicio actualizado correctamente');
            })
            .catch(err => showToast('Error: ' + err, 'error'));
    };
}

function deleteService(id) {
    if (!requireAdminOrToast()) return;
    if (confirm('¿Estás seguro de eliminar este servicio?')) {
        db.collection('servicios').doc(id).delete().then(() => {
            loadAdminData();
            showToast('Servicio eliminado');
        });
    }
}

function clearServiceForm() {
    document.getElementById('serviceName').value = '';
    document.getElementById('servicePriceInput').value = '';
    const saveBtn = document.querySelector('#servicesSection .btn-success');
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Servicio';
    saveBtn.onclick = addService;
}

// ============================================
// GESTIÓN DE EMPLEADOS (ADMIN)
// ============================================
function addEmployee() {
    if (!requireAdminOrToast()) return;
    const name = document.getElementById('employeeName').value.trim();
    const comision = parseInt(document.getElementById('employeeCommission').value);
    if (name && !isNaN(comision)) {
        db.collection('empleados').add({ nombre: name, comision: comision })
            .then(() => { 
                loadAdminData(); 
                clearEmployeeForm();
                showToast('Empleado agregado correctamente');
            })
            .catch(err => showToast('Error: ' + err, 'error'));
    } else {
        showToast('Completa todos los campos', 'error');
    }
}

function editEmployee(id, name, comision) {
    if (!requireAdminOrToast()) return;
    document.getElementById('employeeName').value = name;
    document.getElementById('employeeCommission').value = comision;
    
    document.querySelector('#employeesSection .card').scrollIntoView({ behavior: 'smooth' });
    
    const saveBtn = document.querySelector('#employeesSection .btn-success');
    saveBtn.innerHTML = '<i class="fas fa-edit"></i> Actualizar Empleado';
    saveBtn.onclick = () => {
        const newName = document.getElementById('employeeName').value.trim();
        const newCom = parseInt(document.getElementById('employeeCommission').value);
        db.collection('empleados').doc(id).update({ nombre: newName, comision: newCom })
            .then(() => { 
                loadAdminData(); 
                clearEmployeeForm();
                showToast('Empleado actualizado correctamente');
            })
            .catch(err => showToast('Error: ' + err, 'error'));
    };
}

function deleteEmployee(id) {
    if (!requireAdminOrToast()) return;
    if (confirm('¿Estás seguro de eliminar este empleado?')) {
        db.collection('empleados').doc(id).delete().then(() => {
            loadAdminData();
            showToast('Empleado eliminado');
        });
    }
}

function clearEmployeeForm() {
    document.getElementById('employeeName').value = '';
    document.getElementById('employeeCommission').value = '';
    const saveBtn = document.querySelector('#employeesSection .btn-success');
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Empleado';
    saveBtn.onclick = addEmployee;
}

// ============================================
// GESTIÓN DE INSUMOS (ADMIN)
// ============================================
function addInsumo() {
    if (!requireAdminOrToast()) return;
    const name = document.getElementById('insumoName').value.trim();
    const categoria = document.getElementById('insumoCategory').value.trim();
    const precio = parseInt(document.getElementById('insumoPrice').value);
    const stock = parseInt(document.getElementById('insumoStock').value);
    const file = document.getElementById('insumoImage').files[0];
    
    if (name && categoria && precio && stock) {
        if (file) {
            const storageRef = storage.ref(`insumos/${Date.now()}_${file.name}`);
            storageRef.put(file).then(snapshot => {
                snapshot.ref.getDownloadURL().then(url => {
                    db.collection('insumos').add({
                        nombre: name,
                        categoria: categoria,
                        precio: precio,
                        stock: stock,
                        imagenUrl: url
                    }).then(() => { 
                        loadAdminData(); 
                        clearInsumoForm();
                        showToast('Insumo agregado correctamente');
                    });
                });
            });
        } else {
            db.collection('insumos').add({
                nombre: name,
                categoria: categoria,
                precio: precio,
                stock: stock,
                imagenUrl: ''
            }).then(() => { 
                loadAdminData(); 
                clearInsumoForm();
                showToast('Insumo agregado correctamente');
            });
        }
    } else {
        showToast('Completa todos los campos obligatorios', 'error');
    }
}

function editInsumo(id, name, categoria, precio, stock) {
    if (!requireAdminOrToast()) return;
    document.getElementById('insumoName').value = name;
    document.getElementById('insumoCategory').value = categoria;
    document.getElementById('insumoPrice').value = precio;
    document.getElementById('insumoStock').value = stock;
    
    document.querySelector('#insumosSection .card').scrollIntoView({ behavior: 'smooth' });
    
    const saveBtn = document.querySelector('#insumosSection .btn-success');
    saveBtn.innerHTML = '<i class="fas fa-edit"></i> Actualizar Insumo';
    saveBtn.onclick = () => {
        const newName = document.getElementById('insumoName').value.trim();
        const newCat = document.getElementById('insumoCategory').value.trim();
        const newPrice = parseInt(document.getElementById('insumoPrice').value);
        const newStock = parseInt(document.getElementById('insumoStock').value);
        const file = document.getElementById('insumoImage').files[0];

        const updateData = {
            nombre: newName,
            categoria: newCat,
            precio: newPrice,
            stock: newStock
        };

        if (file) {
            const storageRef = storage.ref(`insumos/${Date.now()}_${file.name}`);
            storageRef.put(file).then(snapshot => {
                snapshot.ref.getDownloadURL().then(url => {
                    updateData.imagenUrl = url;
                    db.collection('insumos').doc(id).update(updateData)
                        .then(() => { 
                            loadAdminData(); 
                            clearInsumoForm();
                            showToast('Insumo actualizado correctamente');
                        });
                });
            });
        } else {
            db.collection('insumos').doc(id).update(updateData)
                .then(() => { 
                    loadAdminData(); 
                    clearInsumoForm();
                    showToast('Insumo actualizado correctamente');
                });
        }
    };
}

function deleteInsumo(id) {
    if (!requireAdminOrToast()) return;
    if (confirm('¿Estás seguro de eliminar este insumo?')) {
        db.collection('insumos').doc(id).delete().then(() => {
            loadAdminData();
            showToast('Insumo eliminado');
        });
    }
}

function clearInsumoForm() {
    document.getElementById('insumoName').value = '';
    document.getElementById('insumoCategory').value = '';
    document.getElementById('insumoPrice').value = '';
    document.getElementById('insumoStock').value = '';
    document.getElementById('insumoImage').value = '';
    const saveBtn = document.querySelector('#insumosSection .btn-success');
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Insumo';
    saveBtn.onclick = addInsumo;
}

// ============================================
// PUNTO DE VENTA
// ============================================
function addInsumoToService() {
    const select = document.getElementById('posInsumoSelect');
    const insumoId = select.value;
    if (!insumoId) {
        showToast('Selecciona un insumo', 'error');
        return;
    }
    
    const insumoName = select.options[select.selectedIndex].dataset.name;
    const insumoPrice = parseFloat(select.options[select.selectedIndex].dataset.price) || 0;
    const insumoStock = parseInt(select.options[select.selectedIndex].dataset.stock) || 0;

    if (insumoStock > 0) {
        const exists = selectedInsumos.some(i => i.id === insumoId);
        if (!exists) {
            selectedInsumos.push({ id: insumoId, nombre: insumoName, precio: insumoPrice });
            renderSelectedInsumos();
            calculateSummary();
            showToast('Insumo agregado');
        } else {
            showToast('Este insumo ya fue agregado', 'error');
        }
    } else {
        showToast('No hay stock disponible', 'error');
    }
}

function renderSelectedInsumos() {
    const container = document.getElementById('selectedInsumos');
    container.innerHTML = '';
    selectedInsumos.forEach((ins, idx) => {
        container.innerHTML += `
            <div class="insumo-tag">
                <i class="fas fa-box"></i>
                ${ins.nombre} - ${formatCOP(ins.precio)}
                <button onclick="removeInsumo(${idx})"><i class="fas fa-times"></i></button>
            </div>
        `;
    });
}

function removeInsumo(index) {
    selectedInsumos.splice(index, 1);
    renderSelectedInsumos();
    calculateSummary();
}

function calculateSummary() {
    const serviceSelect = document.getElementById('posService');
    const employeeSelect = document.getElementById('posEmployee');
    const servicePrice = parseFloat(serviceSelect.options[serviceSelect.selectedIndex]?.dataset.price) || 0;
    const commissionPercent = parseFloat(employeeSelect.options[employeeSelect.selectedIndex]?.dataset.commission) || 0;
    const insumosTotal = selectedInsumos.reduce((total, ins) => total + ins.precio, 0);
    const commission = Math.round((servicePrice * commissionPercent) / 100);
    const total = servicePrice + insumosTotal;

    document.getElementById('summaryServiceTotal').textContent = formatCOP(servicePrice);
    document.getElementById('summaryInsumosTotal').textContent = formatCOP(insumosTotal);
    document.getElementById('summaryCommission').textContent = formatCOP(commission);
    document.getElementById('summaryTotal').textContent = formatCOP(total);
}

function saveService() {
    if (!requireAdminOrToast()) return;
    const serviceId = document.getElementById('posService').value;
    const employeeId = document.getElementById('posEmployee').value;
    const employeeName = document.getElementById('posEmployee').options[document.getElementById('posEmployee').selectedIndex]?.text || '';
    const serviceName = document.getElementById('posService').options[document.getElementById('posService').selectedIndex]?.text || '';
    const client = document.getElementById('posClient').value;
    const servicePrice = parseFloat(document.getElementById('summaryServiceTotal').textContent.replace(/[^0-9,]/g, '').replace(/,/g, '.'));
    const insumosTotal = parseFloat(document.getElementById('summaryInsumosTotal').textContent.replace(/[^0-9,]/g, '').replace(/,/g, '.'));
    const commission = parseFloat(document.getElementById('summaryCommission').textContent.replace(/[^0-9,]/g, '').replace(/,/g, '.'));
    const total = parseFloat(document.getElementById('summaryTotal').textContent.replace(/[^0-9,]/g, '').replace(/,/g, '.'));
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('es-ES');

    if (serviceId && employeeId) {
        db.collection('servicios_realizados').add({
            fecha: date,
            hora: time,
            servicio_id: serviceId,
            servicio_nombre: serviceName,
            empleado_id: employeeId,
            empleado_nombre: employeeName,
            cliente: client || 'Sin nombre',
            precio_servicio: servicePrice,
            insumos_utilizados: JSON.stringify(selectedInsumos),
            total_insumos: insumosTotal,
            comision: commission,
            total_cobrado: total
        }).then(docRef => {
            // Actualizar stock de insumos
            selectedInsumos.forEach(ins => {
                db.collection('insumos').doc(ins.id).update({
                    stock: fieldIncrement(-1)
                });
            });
            
            // Generar vista previa de factura
            generateInvoicePreview(docRef.id, date, time, client, serviceName, servicePrice, insumosTotal, total);
            
            // Reiniciar formulario
            selectedInsumos = [];
            document.getElementById('posClient').value = '';
            document.getElementById('posService').selectedIndex = 0;
            document.getElementById('posEmployee').selectedIndex = 0;
            renderSelectedInsumos();
            calculateSummary();
            document.getElementById('servicePrice').innerHTML = '<i class="fas fa-tag"></i> Precio: $0';
            
            showToast('¡Servicio guardado exitosamente!');
            loadPOSData();
        }).catch(err => showToast('Error al guardar: ' + err, 'error'));
    } else {
        showToast('Selecciona empleado y servicio', 'error');
    }
}

function generateInvoicePreview(id, date, time, client, serviceName, servicePrice, insumosTotal, total) {
    const preview = document.getElementById('invoicePreview');
    preview.innerHTML = `
        <div class="invoice-preview">
            <div class="invoice-header">
                <h3><i class="fas fa-tire"></i> Montallantas Los Castellanos</h3>
                <p>Factura de Servicio</p>
            </div>
            <div style="margin-bottom: 15px;">
                <p><strong>Número:</strong> ${id.substring(0, 8).toUpperCase()}</p>
                <p><strong>Fecha:</strong> ${date} - ${time}</p>
                <p><strong>Cliente:</strong> ${client || 'Sin nombre'}</p>
                <p><strong>Servicio:</strong> ${serviceName}</p>
            </div>
            <hr style="border: 1px solid var(--light); margin: 15px 0;">
            <div style="margin-bottom: 15px;">
                <p>Servicio: <strong>${formatCOP(servicePrice)}</strong></p>
                <p>Insumos: <strong>${formatCOP(insumosTotal)}</strong></p>
            </div>
            <hr style="border: 1px solid var(--light); margin: 15px 0;">
            <p style="font-size: 1.2rem; color: var(--primary);"><strong>TOTAL A PAGAR: ${formatCOP(total)}</strong></p>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button class="btn btn-primary" style="flex: 1;" onclick="printInvoice()">
                    <i class="fas fa-print"></i> Imprimir
                </button>
                <button class="btn btn-success" style="flex: 1;" onclick="sendInvoiceWhatsApp('${id}', '${date}', '${time}', '${client}', '${serviceName}', ${servicePrice}, ${insumosTotal}, ${total})">
                    <i class="fab fa-whatsapp"></i> WhatsApp
                </button>
            </div>
        </div>
    `;
}

function printInvoice() {
    const preview = document.getElementById('invoicePreview').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Factura - Montallantas Los Castellanos</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h3 { color: #FF6B35; }
                hr { border: 1px solid #eee; }
            </style>
        </head>
        <body>${preview}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function sendInvoiceWhatsApp(id, date, time, client, serviceName, servicePrice, insumosTotal, total) {
    const invoiceNumber = id.substring(0, 8).toUpperCase();
    const message = `*Factura - Montallantas Los Castellanos*\n\n` +
        `*Número:* ${invoiceNumber}\n` +
        `*Fecha:* ${date} - ${time}\n` +
        `*Cliente:* ${client || 'Sin nombre'}\n` +
        `*Servicio:* ${serviceName}\n\n` +
        `*Detalle:*\n` +
        `Servicio: ${formatCOP(servicePrice)}\n` +
        `Insumos: ${formatCOP(insumosTotal)}\n\n` +
        `*TOTAL A PAGAR: ${formatCOP(total)}*\n\n` +
        `¡Gracias por su preferencia!`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
}

// ============================================
// VENTA DIRECTA DE INSUMOS
// ============================================
let ventaSelectedInsumos = [];

function loadVentaInsumosData() {
    // Cargar insumos para selección
    db.collection('insumos').get().then(snap => {
        const select = document.getElementById('ventaInsumoSelect');
        select.innerHTML = '<option value="">Seleccionar insumo...</option>';
        snap.forEach(doc => {
            const ins = doc.data();
            select.innerHTML += `<option value="${doc.id}" data-name="${ins.nombre}" data-price="${ins.precio}" data-stock="${ins.stock}">${ins.nombre} (Stock: ${ins.stock})</option>`;
        });
    });
}

function addInsumoToVenta() {
    const select = document.getElementById('ventaInsumoSelect');
    const cantidadInput = document.getElementById('ventaInsumoCantidad');
    const insumoId = select.value;
    const cantidad = parseInt(cantidadInput.value) || 1;
    
    if (!insumoId) {
        showToast('Selecciona un insumo', 'error');
        return;
    }
    
    if (cantidad < 1) {
        showToast('La cantidad debe ser al menos 1', 'error');
        return;
    }
    
    const insumoName = select.options[select.selectedIndex].dataset.name;
    const insumoPrice = parseFloat(select.options[select.selectedIndex].dataset.price) || 0;
    const insumoStock = parseInt(select.options[select.selectedIndex].dataset.stock) || 0;

    if (insumoStock >= cantidad) {
        const exists = ventaSelectedInsumos.some(i => i.id === insumoId);
        if (!exists) {
            ventaSelectedInsumos.push({ 
                id: insumoId, 
                nombre: insumoName, 
                precio: insumoPrice, 
                cantidad: cantidad 
            });
            renderVentaSelectedInsumos();
            calculateVentaSummary();
            showToast('Insumo agregado');
            cantidadInput.value = 1;
        } else {
            showToast('Este insumo ya fue agregado', 'error');
        }
    } else {
        showToast(`No hay suficiente stock. Disponible: ${insumoStock}`, 'error');
    }
}

function renderVentaSelectedInsumos() {
    const container = document.getElementById('ventaSelectedInsumos');
    container.innerHTML = '';
    ventaSelectedInsumos.forEach((ins, idx) => {
        const subtotal = ins.precio * ins.cantidad;
        container.innerHTML += `
            <div class="insumo-tag">
                <i class="fas fa-box"></i>
                ${ins.nombre} x${ins.cantidad} - ${formatCOP(subtotal)}
                <button onclick="removeVentaInsumo(${idx})"><i class="fas fa-times"></i></button>
            </div>
        `;
    });
}

function removeVentaInsumo(index) {
    ventaSelectedInsumos.splice(index, 1);
    renderVentaSelectedInsumos();
    calculateVentaSummary();
}

function calculateVentaSummary() {
    const insumosTotal = ventaSelectedInsumos.reduce((total, ins) => total + (ins.precio * ins.cantidad), 0);
    document.getElementById('ventaInsumosTotal').textContent = formatCOP(insumosTotal);
    document.getElementById('ventaTotal').textContent = formatCOP(insumosTotal);
}

function saveVentaInsumos() {
    if (!requireAdminOrToast()) return;
    const client = document.getElementById('ventaClient').value;
    const insumosTotal = parseFloat(document.getElementById('ventaInsumosTotal').textContent.replace(/[^0-9,]/g, '').replace(/,/g, '.'));
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('es-ES');

    if (ventaSelectedInsumos.length === 0) {
        showToast('Agrega al menos un insumo', 'error');
        return;
    }

    db.collection('ventas_insumos').add({
        fecha: date,
        hora: time,
        cliente: client || 'Sin nombre',
        insumos_vendidos: JSON.stringify(ventaSelectedInsumos),
        total_insumos: insumosTotal,
        total_cobrado: insumosTotal
    }).then(docRef => {
        // Actualizar stock de insumos
        ventaSelectedInsumos.forEach(ins => {
            db.collection('insumos').doc(ins.id).update({
                stock: fieldIncrement(-1)
            });
        });
        
        // Generar vista previa de factura
        generateVentaInvoicePreview(docRef.id, date, time, client, insumosTotal);
        
        // Reiniciar formulario
        ventaSelectedInsumos = [];
        document.getElementById('ventaClient').value = '';
        document.getElementById('ventaInsumoSelect').selectedIndex = 0;
        renderVentaSelectedInsumos();
        calculateVentaSummary();
        
        showToast('¡Venta guardada exitosamente!');
        loadVentaInsumosData();
    }).catch(err => showToast('Error al guardar: ' + err, 'error'));
}

function generateVentaInvoicePreview(id, date, time, client, total) {
    const preview = document.getElementById('ventaInvoicePreview');
    preview.innerHTML = `
        <div class="invoice-preview">
            <div class="invoice-header">
                <h3><i class="fas fa-tire"></i> Montallantas Los Castellanos</h3>
                <p>Factura de Venta de Insumos</p>
            </div>
            <div style="margin-bottom: 15px;">
                <p><strong>Número:</strong> ${id.substring(0, 8).toUpperCase()}</p>
                <p><strong>Fecha:</strong> ${date} - ${time}</p>
                <p><strong>Cliente:</strong> ${client || 'Sin nombre'}</p>
            </div>
            <hr style="border: 1px solid var(--light); margin: 15px 0;">
            <div style="margin-bottom: 15px;">
                ${ventaSelectedInsumos.map(ins => `<p>${ins.nombre}: <strong>${formatCOP(ins.precio)}</strong></p>`).join('')}
            </div>
            <hr style="border: 1px solid var(--light); margin: 15px 0;">
            <p style="font-size: 1.2rem; color: var(--primary);"><strong>TOTAL A PAGAR: ${total.toLocaleString()}</strong></p>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button class="btn btn-primary" style="flex: 1;" onclick="printVentaInvoice()">
                    <i class="fas fa-print"></i> Imprimir
                </button>
                <button class="btn btn-success" style="flex: 1;" onclick="sendVentaInvoiceWhatsApp('${id}', '${date}', '${time}', '${client}', ${total})">
                    <i class="fab fa-whatsapp"></i> WhatsApp
                </button>
            </div>
        </div>
    `;
}

function printVentaInvoice() {
    const preview = document.getElementById('ventaInvoicePreview').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Factura - Montallantas Los Castellanos</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h3 { color: #FF6B35; }
                hr { border: 1px solid #eee; }
            </style>
        </head>
        <body>${preview}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function sendVentaInvoiceWhatsApp(id, date, time, client, total) {
    const invoiceNumber = id.substring(0, 8).toUpperCase();
    const message = `*Factura - Montallantas Los Castellanos*\n\n` +
        `*Número:* ${invoiceNumber}\n` +
        `*Fecha:* ${date} - ${time}\n` +
        `*Cliente:* ${client || 'Sin nombre'}\n\n` +
        `*Detalle de Insumos:*\n` +
        ventaSelectedInsumos.map(ins => `${ins.nombre} x${ins.cantidad}: ${formatCOP(ins.precio * ins.cantidad)}`).join('\n') +
        `\n\n*TOTAL A PAGAR: ${formatCOP(total)}*\n\n` +
        `¡Gracias por su preferencia!`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
}

// ============================================
// REPORTES Y EXPORTACIÓN
// ============================================
function generateReport() {
    const date = document.getElementById('reportDate').value;
    if (date) {
        db.collection('servicios_realizados').where('fecha', '==', date).get().then(snap => {
            currentReportData = [];
            const content = document.getElementById('reportContent');
            
            if (snap.size === 0) {
                content.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-calendar-times"></i>
                        <p>No hay registros para esta fecha</p>
                    </div>
                `;
                return;
            }
            
            let totalVentas = 0;
            let totalInsumos = 0;
            let totalComisiones = 0;

            content.innerHTML = `
                <h3 style="margin-bottom: 15px;"><i class="fas fa-calendar" style="color: var(--primary);"></i> Reporte del ${date}</h3>
                <div class="table-responsive">
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th>Hora</th>
                                <th>Cliente</th>
                                <th>Empleado</th>
                                <th>Servicio</th>
                                <th>Total</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="reportTableBody">
                        </tbody>
                    </table>
                </div>
            `;

            const tbody = document.getElementById('reportTableBody');
            snap.forEach(doc => {
                const data = doc.data();
                currentReportData.push({ id: doc.id, ...data });
                totalVentas += data.totalCobrado;
                totalInsumos += data.totalInsumos;
                totalComisiones += data.comision;

                tbody.innerHTML += `
                    <tr>
                        <td>${data.hora}</td>
                        <td>${data.cliente}</td>
                        <td>${data.empleadoNombre || data.empleadoId}</td>
                        <td>${data.servicioNombre || data.servicioId}</td>
                        <td><strong>${formatCOP(data.totalCobrado)}</strong></td>
                        <td>
                            <button class="btn btn-warning btn-sm" onclick="editServicioRealizado('${doc.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="deleteServicioRealizado('${doc.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });

            content.innerHTML += `
                <div class="stats-grid" style="margin-top: 25px;">
                    <div class="stat-card primary">
                        <div class="stat-icon"><i class="fas fa-dollar-sign"></i></div>
                        <h3>Total Ventas</h3>
                        <div class="stat-value">${formatCOP(totalVentas)}</div>
                    </div>
                    <div class="stat-card success">
                        <div class="stat-icon"><i class="fas fa-box"></i></div>
                        <h3>Total Insumos</h3>
                        <div class="stat-value">${formatCOP(totalInsumos)}</div>
                    </div>
                    <div class="stat-card warning">
                        <div class="stat-icon"><i class="fas fa-coins"></i></div>
                        <h3>Total Comisiones</h3>
                        <div class="stat-value">${formatCOP(totalComisiones)}</div>
                    </div>
                    <div class="stat-card info">
                        <div class="stat-icon"><i class="fas fa-clipboard-list"></i></div>
                        <h3>Servicios Realizados</h3>
                        <div class="stat-value">${snap.size}</div>
                    </div>
                </div>
            `;
            
            showToast('Reporte generado correctamente');
        }).catch(err => showToast('Error al generar reporte: ' + err, 'error'));
    } else {
        showToast('Selecciona una fecha', 'error');
    }
}

function exportToExcel() {
    if (currentReportData.length === 0) {
        showToast('Genera un reporte primero', 'error');
        return;
    }

    const excelData = currentReportData.map(item => ({
        Fecha: item.fecha,
        Hora: item.hora,
        Cliente: item.cliente,
        Empleado: item.empleadoNombre || item.empleadoId,
        Servicio: item.servicioNombre || item.servicioId,
        Precio_Servicio: item.precioServicio,
        Total_Insumos: item.totalInsumos,
        Comision_Empleado: item.comision,
        Total_Cobrado: item.totalCobrado
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte Ventas");
    XLSX.writeFile(wb, `Reporte_Montallantas_${document.getElementById('reportDate').value}.xlsx`);
    
    showToast('Archivo Excel descargado');
}

function deleteServicioRealizado(id) {
    if (!requireAdminOrToast()) return;
    if (confirm('¿Estás seguro de eliminar este servicio? Esta acción no se puede deshacer.')) {
        // Primero obtener los datos para restaurar el stock
        db.collection('servicios_realizados').doc(id).get().then(doc => {
            if (doc.exists) {
                const data = doc.data();
                // Restaurar stock de insumos
                if (data.insumosUtilizados && data.insumosUtilizados.length > 0) {
                    data.insumosUtilizados.forEach(ins => {
                        db.collection('insumos').doc(ins.id).update({
                            stock: fieldIncrement(1)
                        });
                    });
                }
                // Eliminar el registro
                db.collection('servicios_realizados').doc(id).delete().then(() => {
                    showToast('Servicio eliminado correctamente');
                    // Recargar el reporte
                    generateReport();
                }).catch(err => showToast('Error al eliminar: ' + err, 'error'));
            }
        });
    }
}

function editServicioRealizado(id) {
    if (!requireAdminOrToast()) return;
    
    // Obtener los datos del servicio
    db.collection('servicios_realizados').doc(id).get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            
            // Crear modal de edición
            const modal = document.createElement('div');
            modal.className = 'login-screen show';
            modal.id = 'editServiceModal';
            modal.innerHTML = `
                <div class="login-container" style="max-width: 600px;">
                    <div class="login-header">
                        <h2><i class="fas fa-edit"></i> Editar Servicio</h2>
                    </div>
                    <form id="editServiceForm" class="login-form">
                        <div class="form-group">
                            <label><i class="fas fa-user"></i> Cliente</label>
                            <input type="text" id="editClient" class="form-control" value="${data.cliente || ''}">
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-dollar-sign"></i> Precio Servicio</label>
                            <input type="number" id="editServicePrice" class="form-control" value="${data.precioServicio || 0}">
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-box"></i> Total Insumos</label>
                            <input type="number" id="editInsumosTotal" class="form-control" value="${data.totalInsumos || 0}">
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-coins"></i> Comisión</label>
                            <input type="number" id="editCommission" class="form-control" value="${data.comision || 0}">
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-dollar-sign"></i> Total Cobrado</label>
                            <input type="number" id="editTotal" class="form-control" value="${data.totalCobrado || 0}">
                        </div>
                        <button type="submit" class="btn btn-success btn-lg" style="width: 100%;">
                            <i class="fas fa-save"></i> Guardar Cambios
                        </button>
                        <button type="button" class="btn btn-outline" style="width: 100%; margin-top: 10px;" onclick="closeEditModal()">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </form>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Manejar el envío del formulario
            document.getElementById('editServiceForm').addEventListener('submit', (e) => {
                e.preventDefault();
                
                const updatedData = {
                    cliente: document.getElementById('editClient').value,
                    precioServicio: parseInt(document.getElementById('editServicePrice').value),
                    totalInsumos: parseInt(document.getElementById('editInsumosTotal').value),
                    comision: parseInt(document.getElementById('editCommission').value),
                    totalCobrado: parseInt(document.getElementById('editTotal').value)
                };
                
                db.collection('servicios_realizados').doc(id).update(updatedData)
                    .then(() => {
                        showToast('Servicio actualizado correctamente');
                        closeEditModal();
                        generateReport();
                    })
                    .catch(err => showToast('Error al actualizar: ' + err, 'error'));
            });
        }
    });
}

function closeEditModal() {
    const modal = document.getElementById('editServiceModal');
    if (modal) {
        modal.remove();
    }
}

function showEmployeeEarnings() {
    const date = document.getElementById('reportDate').value;
    if (!date) {
        showToast('Selecciona una fecha primero', 'error');
        return;
    }

    // Cargar servicios realizados y préstamos en paralelo
    Promise.all([
        db.collection('servicios_realizados').where('fecha', '==', date).get(),
        db.collection('prestamos').where('fecha', '==', date).get()
    ]).then(([servicesSnap, prestamosSnap]) => {
        if (servicesSnap.size === 0 && prestamosSnap.size === 0) {
            showToast('No hay registros para esta fecha', 'error');
            return;
        }

        // Agrupar por empleado
        const employeeEarnings = {};
        
        // Procesar servicios realizados
        servicesSnap.forEach(doc => {
            const data = doc.data();
            const empId = data.empleadoId;
            const empName = data.empleadoNombre || data.empleadoId;
            const commission = data.comision || 0;

            if (!employeeEarnings[empId]) {
                employeeEarnings[empId] = {
                    nombre: empName,
                    totalComision: 0,
                    totalPrestamos: 0,
                    serviciosRealizados: 0,
                    prestamos: []
                };
            }
            employeeEarnings[empId].totalComision += commission;
            employeeEarnings[empId].serviciosRealizados += 1;
        });

        // Procesar préstamos
        prestamosSnap.forEach(doc => {
            const data = doc.data();
            const empId = data.empleadoId;
            const empName = data.empleadoNombre || data.empleadoId;
            const monto = data.monto || 0;

            if (!employeeEarnings[empId]) {
                employeeEarnings[empId] = {
                    nombre: empName,
                    totalComision: 0,
                    totalPrestamos: 0,
                    serviciosRealizados: 0,
                    prestamos: []
                };
            }
            employeeEarnings[empId].totalPrestamos += monto;
            employeeEarnings[empId].prestamos.push({
                monto: monto,
                motivo: data.motivo || 'Sin motivo',
                hora: data.hora
            });
        });

        // Crear modal de ganancias
        const modal = document.createElement('div');
        modal.className = 'login-screen show';
        modal.id = 'earningsModal';
        
        let earningsHTML = '';
        Object.keys(employeeEarnings).forEach(empId => {
            const emp = employeeEarnings[empId];
            const gananciaNeta = emp.totalComision - emp.totalPrestamos;
            
            let prestamosHTML = '';
            if (emp.prestamos.length > 0) {
                prestamosHTML = `<div style="margin-top: 10px; padding: 10px; background: var(--light); border-radius: 8px;">
                    <small style="color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> Préstamos del día:</small>`;
                emp.prestamos.forEach(pres => {
                    prestamosHTML += `<div style="font-size: 0.9rem; margin-top: 5px;">- ${pres.hora}: ${formatCOP(pres.monto)} (${pres.motivo})</div>`;
                });
                prestamosHTML += `</div>`;
            }
            
            earningsHTML += `
                <div class="list-item" style="flex-direction: column; align-items: flex-start;">
                    <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                        <div class="list-item-info">
                            <div class="list-item-icon">
                                <i class="fas fa-user"></i>
                            </div>
                            <div class="list-item-text">
                                <h4>${emp.nombre}</h4>
                                <p>Servicios realizados: ${emp.serviciosRealizados}</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 1.2rem; font-weight: 600; color: var(--success);">
                                ${formatCOP(emp.totalComision)}
                            </div>
                            <small>Comisión total</small>
                        </div>
                    </div>
                    ${prestamosHTML}
                    <div style="width: 100%; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--light);">
                        <div style="display: flex; justify-content: space-between; width: 100%;">
                            <span><strong>Ganancia Neta:</strong></span>
                            <span style="font-size: 1.3rem; font-weight: 700; color: ${gananciaNeta >= 0 ? 'var(--success)' : 'var(--danger)'};">
                                ${formatCOP(gananciaNeta)}
                            </span>
                        </div>
                        ${emp.totalPrestamos > 0 ? `<small style="color: var(--danger);">Descuento por préstamos: -${formatCOP(emp.totalPrestamos)}</small>` : ''}
                    </div>
                </div>
            `;
        });

        modal.innerHTML = `
            <div class="login-container" style="max-width: 700px;">
                <div class="login-header">
                    <h2><i class="fas fa-coins"></i> Ganancias del Día</h2>
                    <p>Fecha: ${date}</p>
                </div>
                <div style="padding: 20px;">
                    ${earningsHTML}
                </div>
                <button type="button" class="btn btn-outline" style="width: 100%; margin-top: 10px;" onclick="closeEarningsModal()">
                    <i class="fas fa-times"></i> Cerrar
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }).catch(err => showToast('Error al cargar ganancias: ' + err, 'error'));
}

function closeEarningsModal() {
    const modal = document.getElementById('earningsModal');
    if (modal) {
        modal.remove();
    }
}

function formatCOP(amount) {
    return amount.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' COP';
}

// ============================================
// HISTORIAL DE VENTAS DE INSUMOS
// ============================================

function loadHistorialVentasInsumos() {
    const date = document.getElementById('historialVentasInsumosDate').value;
    if (!date) {
        showToast('Selecciona una fecha', 'error');
        return;
    }

    db.collection('ventas_insumos').where('fecha', '==', date).get().then(snap => {
        const list = document.getElementById('historialVentasInsumosList');
        if (snap.size === 0) {
            list.innerHTML = '<div class="empty-state"><i class="fas fa-shopping-cart"></i><p>No hay ventas de insumos para esta fecha</p></div>';
            return;
        }

        let html = '<div class="table-responsive"><table class="report-table"><thead><tr><th>Hora</th><th>Cliente</th><th>Insumos</th><th>Total</th><th>Acciones</th></tr></thead><tbody>';
        snap.forEach(doc => {
            const data = doc.data();
            const insumos = JSON.parse(data.insumos_vendidos || '[]');
            const insumosText = insumos.map(i => `${i.nombre} x${i.cantidad}`).join(', ');
            html += `
                <tr>
                    <td>${data.hora}</td>
                    <td>${data.cliente}</td>
                    <td>${insumosText}</td>
                    <td>${formatCOP(data.total_cobrado)}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="editVentaInsumo('${doc.id}')"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="deleteVentaInsumo('${doc.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
        list.innerHTML = html;
    }).catch(err => showToast('Error al cargar historial: ' + err, 'error'));
}

function editVentaInsumo(id) {
    if (!requireAdminOrToast()) return;
    db.collection('ventas_insumos').doc(id).get().then(doc => {
        if (!doc.exists) {
            showToast('Venta no encontrada', 'error');
            return;
        }
        const data = doc.data();
        const insumos = JSON.parse(data.insumos_vendidos || '[]');
        
        // Llenar el formulario con los datos existentes
        document.getElementById('ventaClient').value = data.cliente;
        ventaSelectedInsumos = insumos;
        renderVentaSelectedInsumos();
        calculateVentaSummary();
        
        // Cambiar el botón de guardar para que actualice en lugar de crear
        const saveBtn = document.querySelector('#ventaInsumosSection .btn-success');
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar Venta';
        saveBtn.onclick = function() { updateVentaInsumo(id); };
        
        // Mostrar la sección de venta de insumos
        showSection('ventaInsumosSection');
        showToast('Editando venta. Modifica los datos y guarda.', 'success');
    }).catch(err => showToast('Error al cargar venta: ' + err, 'error'));
}

function updateVentaInsumo(id) {
    if (!requireAdminOrToast()) return;
    const client = document.getElementById('ventaClient').value;
    const total = parseFloat(document.getElementById('ventaTotal').textContent.replace(/[^0-9.-]/g, '')) || 0;

    if (ventaSelectedInsumos.length === 0) {
        showToast('Agrega al menos un insumo', 'error');
        return;
    }

    // Restaurar stock anterior
    db.collection('ventas_insumos').doc(id).get().then(doc => {
        const oldData = doc.data();
        const oldInsumos = JSON.parse(oldData.insumos_vendidos || '[]');
        
        // Restaurar stock de insumos antiguos
        oldInsumos.forEach(insumo => {
            db.collection('insumos').doc(insumo.id).get().then(insumoDoc => {
                if (insumoDoc.exists) {
                    const currentStock = insumoDoc.data().stock || 0;
                    db.collection('insumos').doc(insumo.id).update({
                        stock: currentStock + insumo.cantidad
                    });
                }
            });
        });

        // Reducir stock de insumos nuevos
        ventaSelectedInsumos.forEach(insumo => {
            db.collection('insumos').doc(insumo.id).get().then(insumoDoc => {
                if (insumoDoc.exists) {
                    const currentStock = insumoDoc.data().stock || 0;
                    db.collection('insumos').doc(insumo.id).update({
                        stock: Math.max(0, currentStock - insumo.cantidad)
                    });
                }
            });
        });

        // Actualizar la venta
        db.collection('ventas_insumos').doc(id).update({
            cliente: client,
            insumos_vendidos: JSON.stringify(ventaSelectedInsumos),
            total_cobrado: total
        }).then(() => {
            showToast('Venta actualizada correctamente', 'success');
            resetVentaInsumosForm();
            loadHistorialVentasInsumos();
        }).catch(err => showToast('Error al actualizar: ' + err, 'error'));
    }).catch(err => showToast('Error al restaurar stock: ' + err, 'error'));
}

function deleteVentaInsumo(id) {
    if (!requireAdminOrToast()) return;
    if (!confirm('¿Estás seguro de eliminar esta venta? Se restaurará el stock de los insumos.')) {
        return;
    }

    db.collection('ventas_insumos').doc(id).get().then(doc => {
        if (!doc.exists) {
            showToast('Venta no encontrada', 'error');
            return;
        }
        const data = doc.data();
        const insumos = JSON.parse(data.insumos_vendidos || '[]');
        
        // Restaurar stock
        insumos.forEach(insumo => {
            db.collection('insumos').doc(insumo.id).get().then(insumoDoc => {
                if (insumoDoc.exists) {
                    const currentStock = insumoDoc.data().stock || 0;
                    db.collection('insumos').doc(insumo.id).update({
                        stock: currentStock + insumo.cantidad
                    });
                }
            });
        });

        // Eliminar la venta
        db.collection('ventas_insumos').doc(id).delete().then(() => {
            showToast('Venta eliminada y stock restaurado', 'success');
            loadHistorialVentasInsumos();
        }).catch(err => showToast('Error al eliminar: ' + err, 'error'));
    }).catch(err => showToast('Error al cargar venta: ' + err, 'error'));
}

function resetVentaInsumosForm() {
    document.getElementById('ventaClient').value = '';
    ventaSelectedInsumos = [];
    renderVentaSelectedInsumos();
    calculateVentaSummary();
    const saveBtn = document.querySelector('#ventaInsumosSection .btn-success');
    saveBtn.innerHTML = '<i class="fas fa-check-circle"></i> Guardar Venta';
    saveBtn.onclick = saveVentaInsumos;
}

// ============================================
// PRÉSTAMOS A EMPLEADOS
// ============================================
function loadPrestamosData() {
    // Cargar empleados para selección
    db.collection('empleados').get().then(snap => {
        const select = document.getElementById('prestamoEmployee');
        select.innerHTML = '<option value="">Seleccionar empleado...</option>';
        snap.forEach(doc => {
            const emp = doc.data();
            select.innerHTML += `<option value="${doc.id}" data-name="${emp.nombre}">${emp.nombre}</option>`;
        });
    });

    // Cargar préstamos del día
    const today = new Date().toISOString().split('T')[0];
    db.collection('prestamos').where('fecha', '==', today).get().then(snap => {
        const list = document.getElementById('prestamosList');
        if (snap.size === 0) {
            list.innerHTML = `<div class="empty-state"><i class="fas fa-hand-holding-usd"></i><p>No hay préstamos registrados hoy</p></div>`;
            return;
        }
        list.innerHTML = '';
        snap.forEach(doc => {
            const pres = doc.data();
            list.innerHTML += `
                <div class="list-item">
                    <div class="list-item-info">
                        <div class="list-item-icon">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="list-item-text">
                            <h4>${pres.empleadoNombre}</h4>
                            <p>${pres.hora} - ${pres.motivo || 'Sin motivo'}</p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.2rem; font-weight: 600; color: var(--danger);">
                            - ${formatCOP(pres.monto)}
                        </div>
                        <button class="btn btn-danger btn-sm" onclick="deletePrestamo('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    });
}

function addPrestamo() {
    if (!requireAdminOrToast()) return;
    const employeeId = document.getElementById('prestamoEmployee').value;
    const employeeName = document.getElementById('prestamoEmployee').options[document.getElementById('prestamoEmployee').selectedIndex]?.text || '';
    const amount = parseFloat(document.getElementById('prestamoAmount').value);
    const reason = document.getElementById('prestamoReason').value.trim();
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('es-ES');

    if (!employeeId) {
        showToast('Selecciona un empleado', 'error');
        return;
    }

    if (!amount || amount <= 0) {
        showToast('Ingresa un monto válido', 'error');
        return;
    }

    db.collection('prestamos').add({
        fecha: date,
        hora: time,
        empleadoId: employeeId,
        empleadoNombre: employeeName,
        monto: amount,
        motivo: reason || 'Sin motivo'
    }).then(() => {
        showToast('Préstamo registrado correctamente');
        document.getElementById('prestamoAmount').value = '';
        document.getElementById('prestamoReason').value = '';
        document.getElementById('prestamoEmployee').selectedIndex = 0;
        loadPrestamosData();
    }).catch(err => showToast('Error al guardar: ' + err, 'error'));
}

function deletePrestamo(id) {
    if (!requireAdminOrToast()) return;
    if (confirm('¿Estás seguro de eliminar este préstamo?')) {
        db.collection('prestamos').doc(id).delete().then(() => {
            showToast('Préstamo eliminado');
            loadPrestamosData();
        }).catch(err => showToast('Error al eliminar: ' + err, 'error'));
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================
window.onload = () => {
    updateCurrentDate();
    document.getElementById('reportDate').value = new Date().toISOString().split('T')[0];

    if (dataMode === 'local') {
        showToast('Modo local activo. Los datos se guardan localmente.', 'success');
        loadDashboardData();
        loadPOSData();
        loadAdminData();
        return;
    }

    initAuthListener();
};
