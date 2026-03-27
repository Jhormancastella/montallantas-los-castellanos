(function () {
    const appConfig = window.APP_CONFIG || {};

    function createIncrementToken(value) {
        return {
            __operation: "increment",
            value
        };
    }

    function cloneData(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function createDocSnapshot(id, data) {
        return {
            id,
            data() {
                return cloneData(data);
            }
        };
    }

    function createQuerySnapshot(entries) {
        const docs = entries.map(({ id, data }) => createDocSnapshot(id, data));

        return {
            size: docs.length,
            docs,
            forEach(callback) {
                docs.forEach((doc) => callback(doc));
            }
        };
    }

    function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo."));
            reader.readAsDataURL(file);
        });
    }

    function createLocalStorageAdapter(config) {
        const storageKey = config?.storageKeys?.database || "montallantas_los_castellanos_db";

        function readStore() {
            try {
                return JSON.parse(localStorage.getItem(storageKey)) || {};
            } catch (error) {
                console.warn("No se pudo leer la base local, se reiniciara.", error);
                return {};
            }
        }

        function writeStore(store) {
            localStorage.setItem(storageKey, JSON.stringify(store));
        }

        function getCollectionEntries(collectionName) {
            const store = readStore();
            const collection = store[collectionName] || {};

            return Object.entries(collection).map(([id, data]) => ({
                id,
                data: cloneData(data)
            }));
        }

        function saveCollectionEntry(collectionName, id, data) {
            const store = readStore();
            store[collectionName] = store[collectionName] || {};
            store[collectionName][id] = cloneData(data);
            writeStore(store);
        }

        function removeCollectionEntry(collectionName, id) {
            const store = readStore();
            if (!store[collectionName]) {
                return;
            }

            delete store[collectionName][id];
            writeStore(store);
        }

        function applyUpdates(currentData, updates) {
            const nextData = { ...currentData };

            Object.entries(updates).forEach(([key, value]) => {
                if (value && value.__operation === "increment") {
                    const currentValue = Number(nextData[key] || 0);
                    nextData[key] = currentValue + Number(value.value || 0);
                    return;
                }

                nextData[key] = value;
            });

            return nextData;
        }

        function sortEntries(entries, orderField, direction) {
            if (!orderField) {
                return entries;
            }

            const multiplier = direction === "desc" ? -1 : 1;

            return [...entries].sort((a, b) => {
                const valueA = a.data[orderField];
                const valueB = b.data[orderField];

                if (valueA === valueB) {
                    return 0;
                }

                return valueA > valueB ? multiplier : -multiplier;
            });
        }

        function createQuery(collectionName, options = {}) {
            const queryState = {
                filters: options.filters || [],
                order: options.order || null,
                limit: options.limit || null
            };

            function resolveEntries() {
                let entries = getCollectionEntries(collectionName);

                queryState.filters.forEach((filter) => {
                    entries = entries.filter(({ data }) => data[filter.field] === filter.value);
                });

                if (queryState.order) {
                    entries = sortEntries(entries, queryState.order.field, queryState.order.direction);
                }

                if (typeof queryState.limit === "number") {
                    entries = entries.slice(0, queryState.limit);
                }

                return entries;
            }

            return {
                where(field, operator, value) {
                    if (operator !== "==") {
                        throw new Error("El modo local solo soporta filtros '=='.");
                    }

                    return createQuery(collectionName, {
                        ...queryState,
                        filters: [...queryState.filters, { field, value }]
                    });
                },
                orderBy(field, direction = "asc") {
                    return createQuery(collectionName, {
                        ...queryState,
                        order: { field, direction }
                    });
                },
                limit(value) {
                    return createQuery(collectionName, {
                        ...queryState,
                        limit: value
                    });
                },
                get() {
                    return Promise.resolve(createQuerySnapshot(resolveEntries()));
                },
                onSnapshot(callback) {
                    callback(createQuerySnapshot(resolveEntries()));
                    return () => {};
                },
                add(data) {
                    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                    saveCollectionEntry(collectionName, id, data);
                    return Promise.resolve({ id });
                },
                doc(id) {
                    return {
                        update(updates) {
                            const currentEntry = getCollectionEntries(collectionName).find((entry) => entry.id === id);

                            if (!currentEntry) {
                                return Promise.reject(new Error(`No existe el registro ${id}.`));
                            }

                            saveCollectionEntry(collectionName, id, applyUpdates(currentEntry.data, updates));
                            return Promise.resolve();
                        },
                        delete() {
                            removeCollectionEntry(collectionName, id);
                            return Promise.resolve();
                        }
                    };
                }
            };
        }

        const localStorageService = {
            ref(path) {
                return {
                    put(file) {
                        return fileToDataUrl(file).then((dataUrl) => ({
                            ref: {
                                fullPath: path,
                                getDownloadURL() {
                                    return Promise.resolve(dataUrl);
                                }
                            }
                        }));
                    }
                };
            }
        };

        return {
            mode: "local",
            db: {
                collection(collectionName) {
                    return createQuery(collectionName);
                }
            },
            storage: localStorageService,
            auth: null,
            fieldIncrement: createIncrementToken
        };
    }

    function createFirebaseAdapter(config) {
        if (!window.firebase) {
            throw new Error("Firebase no esta disponible en la pagina.");
        }

        const firebaseConfig = config?.firebase?.config;

        if (!firebaseConfig || !firebaseConfig.projectId || firebaseConfig.projectId === "TU_PROJECT_ID") {
            throw new Error("La configuracion de Firebase aun no ha sido completada.");
        }

        if (!window.firebase.apps.length) {
            window.firebase.initializeApp(firebaseConfig);
        }

        return {
            mode: "firebase",
            db: window.firebase.firestore(),
            storage: window.firebase.storage(),
            auth: window.firebase.auth(),
            fieldIncrement(value) {
                return window.firebase.firestore.FieldValue.increment(value);
            }
        };
    }

    function createSupabaseAdapter(config) {
        const supabaseConfig = config?.supabase;
        if (!supabaseConfig?.url || !supabaseConfig?.anonKey) {
            throw new Error("Configuracion de Supabase incompleta.");
        }
        if (!window.supabase?.createClient) {
            throw new Error("SDK de Supabase no esta disponible.");
        }

        const client = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey);

        function normalizeRow(row) {
            if (!row) return row;
            const normalized = { ...row };
            if ("imagen_url" in normalized) {
                normalized.imagenUrl = normalized.imagen_url;
                delete normalized.imagen_url;
            }
            if ("servicio_id" in normalized) {
                normalized.servicioId = normalized.servicio_id;
                delete normalized.servicio_id;
            }
            if ("servicio_nombre" in normalized) {
                normalized.servicioNombre = normalized.servicio_nombre;
                delete normalized.servicio_nombre;
            }
            if ("empleado_id" in normalized) {
                normalized.empleadoId = normalized.empleado_id;
                delete normalized.empleado_id;
            }
            if ("empleado_nombre" in normalized) {
                normalized.empleadoNombre = normalized.empleado_nombre;
                delete normalized.empleado_nombre;
            }
            if ("precio_servicio" in normalized) {
                normalized.precioServicio = Number(normalized.precio_servicio || 0);
                delete normalized.precio_servicio;
            }
            if ("insumos_utilizados" in normalized) {
                normalized.insumosUtilizados = normalized.insumos_utilizados || [];
                delete normalized.insumos_utilizados;
            }
            if ("total_insumos" in normalized) {
                normalized.totalInsumos = Number(normalized.total_insumos || 0);
                delete normalized.total_insumos;
            }
            if ("total_cobrado" in normalized) {
                normalized.totalCobrado = Number(normalized.total_cobrado || 0);
                delete normalized.total_cobrado;
            }
            return normalized;
        }

        function serializeData(data) {
            if (!data || typeof data !== "object") {
                return data;
            }

            const serialized = { ...data };
            if ("imagenUrl" in serialized) {
                serialized.imagen_url = serialized.imagenUrl;
                delete serialized.imagenUrl;
            }
            if ("servicioId" in serialized) {
                serialized.servicio_id = serialized.servicioId;
                delete serialized.servicioId;
            }
            if ("servicioNombre" in serialized) {
                serialized.servicio_nombre = serialized.servicioNombre;
                delete serialized.servicioNombre;
            }
            if ("empleadoId" in serialized) {
                serialized.empleado_id = serialized.empleadoId;
                delete serialized.empleadoId;
            }
            if ("empleadoNombre" in serialized) {
                serialized.empleado_nombre = serialized.empleadoNombre;
                delete serialized.empleadoNombre;
            }
            if ("precioServicio" in serialized) {
                serialized.precio_servicio = serialized.precioServicio;
                delete serialized.precioServicio;
            }
            if ("insumosUtilizados" in serialized) {
                serialized.insumos_utilizados = serialized.insumosUtilizados;
                delete serialized.insumosUtilizados;
            }
            if ("totalInsumos" in serialized) {
                serialized.total_insumos = serialized.totalInsumos;
                delete serialized.totalInsumos;
            }
            if ("totalCobrado" in serialized) {
                serialized.total_cobrado = serialized.totalCobrado;
                delete serialized.totalCobrado;
            }

            Object.keys(serialized).forEach((key) => {
                const value = serialized[key];
                if (value && value.__operation === "increment") {
                    // Se procesa en doc().update()
                    delete serialized[key];
                }
            });

            return serialized;
        }

        function createSupabaseQuery(tableName, state = { filters: [] }) {
            return {
                where(field, operator, value) {
                    if (operator !== "==") {
                        throw new Error("Supabase adapter solo soporta operador '=='.");
                    }
                    return createSupabaseQuery(tableName, {
                        ...state,
                        filters: [...state.filters, { field, value }]
                    });
                },
                get() {
                    let query = client.from(tableName).select("*");
                    state.filters.forEach((filter) => {
                        query = query.eq(filter.field, filter.value);
                    });
                    return query.then(({ data, error }) => {
                        if (error) throw error;
                        const rows = (data || []).map(normalizeRow);
                        return createQuerySnapshot(rows.map((row) => ({ id: row.id, data: row })));
                    });
                },
                add(data) {
                    const payload = serializeData(data);
                    return client
                        .from(tableName)
                        .insert(payload)
                        .select("id")
                        .single()
                        .then(({ data: inserted, error }) => {
                            if (error) throw error;
                            return { id: inserted.id };
                        });
                },
                doc(id) {
                    return {
                        get() {
                            return client
                                .from(tableName)
                                .select("*")
                                .eq("id", id)
                                .maybeSingle()
                                .then(({ data, error }) => {
                                    if (error) throw error;
                                    if (!data) {
                                        return {
                                            exists: false,
                                            data() {
                                                return null;
                                            }
                                        };
                                    }
                                    const normalized = normalizeRow(data);
                                    return {
                                        exists: true,
                                        data() {
                                            return cloneData(normalized);
                                        }
                                    };
                                });
                        },
                        update(updates) {
                            const updatePayload = serializeData(updates);
                            const incrementEntries = Object.entries(updates || {}).filter(([, value]) => value && value.__operation === "increment");
                            if (incrementEntries.length === 0) {
                                return client.from(tableName).update(updatePayload).eq("id", id).then(({ error }) => {
                                    if (error) throw error;
                                });
                            }
                            return this.get().then((snapshot) => {
                                if (!snapshot.exists) {
                                    throw new Error(`No existe el registro ${id}.`);
                                }
                                const currentData = snapshot.data() || {};
                                incrementEntries.forEach(([key, value]) => {
                                    const currentValue = Number(currentData[key] || 0);
                                    updatePayload[key] = currentValue + Number(value.value || 0);
                                });
                                return client.from(tableName).update(serializeData(updatePayload)).eq("id", id).then(({ error }) => {
                                    if (error) throw error;
                                });
                            });
                        },
                        delete() {
                            return client.from(tableName).delete().eq("id", id).then(({ error }) => {
                                if (error) throw error;
                            });
                        }
                    };
                }
            };
        }

        const pseudoStorage = {
            ref(path) {
                return {
                    put(file) {
                        return fileToDataUrl(file).then((dataUrl) => ({
                            ref: {
                                fullPath: path,
                                getDownloadURL() {
                                    return Promise.resolve(dataUrl);
                                }
                            }
                        }));
                    }
                };
            }
        };

        const auth = config?.firebase?.enabled ? createFirebaseAdapter(config).auth : null;

        return {
            mode: "supabase",
            db: {
                collection(collectionName) {
                    return createSupabaseQuery(collectionName);
                }
            },
            storage: pseudoStorage,
            auth,
            fieldIncrement: createIncrementToken
        };
    }

    function createAppServices(config) {
        if (config?.supabase?.enabled) {
            try {
                return createSupabaseAdapter(config);
            } catch (error) {
                console.warn("No se pudo activar Supabase, se intentara Firebase.", error);
            }
        }

        if (config?.firebase?.enabled) {
            try {
                return createFirebaseAdapter(config);
            } catch (error) {
                console.warn("No se pudo activar Firebase, se usara el modo local.", error);
            }
        }

        return createLocalStorageAdapter(config);
    }

    window.appServices = createAppServices(appConfig);
})();
