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
        document.getElementById('statVentasHoy').textContent = '$' + total.toLocaleString();
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
                                <p>${data.hora} - $${data.totalCobrado.toLocaleString()}</p>
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
    const price = select.options[select.selectedIndex].dataset.price || 0;
    document.getElementById('servicePrice').innerHTML = `<i class="fas fa-tag"></i> Precio: $${parseInt(price).toLocaleString()}`;
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
    const insumoPrice = parseInt(select.options[select.selectedIndex].dataset.price);
    const insumoStock = parseInt(select.options[select.selectedIndex].dataset.stock);

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
                ${ins.nombre} - $${ins.precio.toLocaleString()}
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
    const servicePrice = parseInt(serviceSelect.options[serviceSelect.selectedIndex]?.dataset.price || 0);
    const commissionPercent = parseInt(employeeSelect.options[employeeSelect.selectedIndex]?.dataset.commission || 0);
    const insumosTotal = selectedInsumos.reduce((total, ins) => total + ins.precio, 0);
    const commission = Math.round((servicePrice * commissionPercent) / 100);
    const total = servicePrice + insumosTotal;

    document.getElementById('summaryServiceTotal').textContent = servicePrice.toLocaleString();
    document.getElementById('summaryInsumosTotal').textContent = insumosTotal.toLocaleString();
    document.getElementById('summaryCommission').textContent = commission.toLocaleString();
    document.getElementById('summaryTotal').textContent = total.toLocaleString();
}

function saveService() {
    if (!requireAdminOrToast()) return;
    const serviceId = document.getElementById('posService').value;
    const employeeId = document.getElementById('posEmployee').value;
    const employeeName = document.getElementById('posEmployee').options[document.getElementById('posEmployee').selectedIndex]?.text || '';
    const serviceName = document.getElementById('posService').options[document.getElementById('posService').selectedIndex]?.text || '';
    const client = document.getElementById('posClient').value;
    const servicePrice = parseInt(document.getElementById('summaryServiceTotal').textContent.replace(/,/g, ''));
    const insumosTotal = parseInt(document.getElementById('summaryInsumosTotal').textContent.replace(/,/g, ''));
    const commission = parseInt(document.getElementById('summaryCommission').textContent.replace(/,/g, ''));
    const total = parseInt(document.getElementById('summaryTotal').textContent.replace(/,/g, ''));
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('es-ES');

    if (serviceId && employeeId) {
        db.collection('servicios_realizados').add({
            fecha: date,
            hora: time,
            servicioId: serviceId,
            servicioNombre: serviceName,
            empleadoId: employeeId,
            empleadoNombre: employeeName,
            cliente: client || 'Sin nombre',
            precioServicio: servicePrice,
            insumosUtilizados: selectedInsumos,
            totalInsumos: insumosTotal,
            comision: commission,
            totalCobrado: total
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
                <p>Servicio: <strong>$${servicePrice.toLocaleString()}</strong></p>
                <p>Insumos: <strong>$${insumosTotal.toLocaleString()}</strong></p>
            </div>
            <hr style="border: 1px solid var(--light); margin: 15px 0;">
            <p style="font-size: 1.2rem; color: var(--primary);"><strong>TOTAL A PAGAR: $${total.toLocaleString()}</strong></p>
            <button class="btn btn-primary" style="width: 100%; margin-top: 15px;" onclick="printInvoice()">
                <i class="fas fa-print"></i> Imprimir Factura
            </button>
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
                currentReportData.push(data);
                totalVentas += data.totalCobrado;
                totalInsumos += data.totalInsumos;
                totalComisiones += data.comision;

                tbody.innerHTML += `
                    <tr>
                        <td>${data.hora}</td>
                        <td>${data.cliente}</td>
                        <td>${data.empleadoNombre || data.empleadoId}</td>
                        <td>${data.servicioNombre || data.servicioId}</td>
                        <td><strong>$${data.totalCobrado.toLocaleString()}</strong></td>
                    </tr>
                `;
            });

            content.innerHTML += `
                <div class="stats-grid" style="margin-top: 25px;">
                    <div class="stat-card primary">
                        <div class="stat-icon"><i class="fas fa-dollar-sign"></i></div>
                        <h3>Total Ventas</h3>
                        <div class="stat-value">$${totalVentas.toLocaleString()}</div>
                    </div>
                    <div class="stat-card success">
                        <div class="stat-icon"><i class="fas fa-box"></i></div>
                        <h3>Total Insumos</h3>
                        <div class="stat-value">$${totalInsumos.toLocaleString()}</div>
                    </div>
                    <div class="stat-card warning">
                        <div class="stat-icon"><i class="fas fa-coins"></i></div>
                        <h3>Total Comisiones</h3>
                        <div class="stat-value">$${totalComisiones.toLocaleString()}</div>
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
