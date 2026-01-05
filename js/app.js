/**
 * Main Application Module
 * Coordinates all components and handles UI interactions
 */

const App = (function() {
    'use strict';

    // Application state
    let state = {
        layers: [],
        initialBounds: null,
        sidebarOpen: window.innerWidth >= 1024,
        isOnline: navigator.onLine,
        isTracking: false
    };

    // DOM Elements
    const elements = {};

    /**
     * Initialize the application
     */
    async function init() {
        // Cache DOM elements
        cacheElements();

        // Initialize database
        await DataHandler.initDB();

        // Initialize map
        MapModule.init('map');

        // Setup event listeners
        setupEventListeners();

        // Auto-load layers from manifest
        await autoLoadLayers();

        // Load agency logos
        await loadAgencyLogos();

        // Update online status
        updateOnlineStatus();

        // Register service worker
        registerServiceWorker();

        // Update initial state
        updateSidebarState();

        console.log('MAPS-OPS initialized');
    }

    /**
     * Auto-load layers from layers/layers.json manifest
     */
    async function autoLoadLayers() {
        // Layer colors - distinct for each type
        const layerStyles = {
            'Avy_Paths': { color: '#ef4444', name: 'Avalanche Paths' },      // Red
            'Closure_Gates': { color: '#f59e0b', name: 'Closure Gates' },    // Orange/Yellow
            'Pad_Locations': { color: '#22c55e', name: 'Gun Pads' }          // Green
        };

        // Load icons config
        let iconsConfig = { defaultSize: 32, icons: [] };
        try {
            const iconsResponse = await fetch('images/icons/icons.json');
            if (iconsResponse.ok) {
                iconsConfig = await iconsResponse.json();
                console.log(`Loaded icons config: ${iconsConfig.icons.length} icons defined`);
            }
        } catch (err) {
            console.warn('No icons config found, using default circles');
        }

        try {
            // Fetch manifest
            const manifestResponse = await fetch('layers/layers.json');
            if (!manifestResponse.ok) {
                console.warn('No layers manifest found');
                return;
            }
            const manifest = await manifestResponse.json();

            const loadedLayers = [];
            let allBounds = null;

            for (const filename of manifest.files) {
                try {
                    const response = await fetch(`layers/${filename}`);
                    if (!response.ok) continue;

                    const geojsonText = await response.text();
                    const parsed = DataHandler.parseGeoJSON(geojsonText, filename);
                    const baseName = filename.replace('.geojson', '');
                    const style = layerStyles[baseName] || { color: '#3b82f6', name: baseName };

                    // Check for matching icon (matches layer name to icon layer name)
                    const iconConfig = iconsConfig.icons.find(i => i.layer === baseName);
                    let icon = null;
                    if (iconConfig) {
                        icon = {
                            url: `images/icons/${iconConfig.file}`,
                            size: iconConfig.size || iconsConfig.defaultSize
                        };
                    }

                    const layer = {
                        id: `layer_${baseName}`,
                        name: style.name,
                        color: style.color,
                        visible: true,
                        data: parsed.data,
                        featureCount: parsed.featureCount,
                        bounds: parsed.bounds,
                        icon: icon  // Will be null for polygon layers, set for point layers with icons
                    };

                    loadedLayers.push(layer);

                    // Expand overall bounds
                    if (parsed.bounds) {
                        if (!allBounds) {
                            allBounds = [[...parsed.bounds[0]], [...parsed.bounds[1]]];
                        } else {
                            allBounds[0][0] = Math.min(allBounds[0][0], parsed.bounds[0][0]);
                            allBounds[0][1] = Math.min(allBounds[0][1], parsed.bounds[0][1]);
                            allBounds[1][0] = Math.max(allBounds[1][0], parsed.bounds[1][0]);
                            allBounds[1][1] = Math.max(allBounds[1][1], parsed.bounds[1][1]);
                        }
                    }

                    console.log(`Loaded: ${style.name} (${parsed.featureCount} features)`);
                } catch (err) {
                    console.warn(`Failed to load ${filename}:`, err);
                }
            }

            if (loadedLayers.length > 0) {
                state.layers = loadedLayers;
                state.initialBounds = allBounds;
                renderLayersList();

                // If map already loaded, add layers immediately
                const map = MapModule.getMap();
                if (map && map.loaded()) {
                    loadedLayers.forEach(layer => {
                        MapModule.addLayer(layer);
                    });
                    if (allBounds) {
                        MapModule.fitBounds(allBounds);
                    }
                }
                // Otherwise, handleMapLoaded will add them when map:loaded fires
            }

        } catch (error) {
            console.error('Failed to auto-load layers:', error);
        }
    }

    /**
     * Load agency logos from images/logos/logos.json
     */
    async function loadAgencyLogos() {
        try {
            const response = await fetch('images/logos/logos.json');
            if (!response.ok) return;

            const data = await response.json();
            const container = document.getElementById('agency-logos');
            if (!container || !data.logos || data.logos.length === 0) return;

            data.logos.forEach(logo => {
                const img = document.createElement('img');
                img.src = `images/logos/${logo.file}`;
                img.alt = logo.name || 'Agency logo';
                img.title = logo.name || '';
                img.className = 'agency-logo';
                container.appendChild(img);
            });

            console.log(`Loaded ${data.logos.length} agency logos`);
        } catch (error) {
            console.warn('Could not load agency logos:', error);
        }
    }

    /**
     * Cache DOM elements for performance
     */
    function cacheElements() {
        elements.menuToggle = document.getElementById('menu-toggle');
        elements.sidebar = document.getElementById('sidebar');
        elements.layersList = document.getElementById('layers-list');
        elements.locateBtn = document.getElementById('locate-btn');
        elements.zoomInBtn = document.getElementById('zoom-in-btn');
        elements.zoomOutBtn = document.getElementById('zoom-out-btn');
        elements.compassBtn = document.getElementById('compass-btn');
        elements.connectionStatus = document.getElementById('connection-status');
        elements.latValue = document.getElementById('lat-value');
        elements.lngValue = document.getElementById('lng-value');
        elements.accuracyValue = document.getElementById('accuracy-value');
        elements.featurePopup = document.getElementById('feature-popup');
        elements.popupTitle = document.getElementById('popup-title');
        elements.popupContent = document.getElementById('popup-content');
        elements.popupClose = document.getElementById('popup-close');
        elements.loadingOverlay = document.getElementById('loading-overlay');
        elements.toastContainer = document.getElementById('toast-container');
    }

    /**
     * Setup all event listeners
     */
    function setupEventListeners() {
        // Menu toggle
        elements.menuToggle.addEventListener('click', toggleSidebar);

        // Map controls
        elements.locateBtn.addEventListener('click', handleLocate);
        elements.zoomInBtn.addEventListener('click', () => MapModule.zoomIn());
        elements.zoomOutBtn.addEventListener('click', () => MapModule.zoomOut());
        elements.compassBtn.addEventListener('click', () => MapModule.resetNorth());

        // Popup close
        elements.popupClose.addEventListener('click', hideFeaturePopup);

        // Online/Offline events
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        // Window resize
        window.addEventListener('resize', debounce(handleResize, 200));

        // Map events
        document.addEventListener('map:loaded', handleMapLoaded);
        document.addEventListener('feature:click', handleFeatureClick);
        document.addEventListener('position:update', handlePositionUpdate);
        document.addEventListener('position:error', handlePositionError);

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeydown);

        // Close sidebar on map click (mobile)
        document.addEventListener('map:click', () => {
            if (window.innerWidth < 1024 && state.sidebarOpen) {
                toggleSidebar();
            }
        });
    }

    /**
     * Handle map loaded event
     */
    function handleMapLoaded() {
        MapModule.updateScaleBar();

        // Add saved layers to map (small delay ensures basemap is fully rendered)
        setTimeout(() => {
            state.layers.forEach(layer => {
                MapModule.addLayer(layer);
            });

            // Fit to bounds if available
            if (state.initialBounds) {
                MapModule.fitBounds(state.initialBounds);
            }
        }, 100);
    }

    /**
     * Load saved layers from IndexedDB
     */
    async function loadSavedLayers() {
        try {
            state.layers = await DataHandler.getAllLayers();
            renderLayersList();
        } catch (error) {
            console.error('Failed to load saved layers:', error);
        }
    }

    /**
     * Handle file selection
     */
    async function handleFileSelect(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        showLoading();

        for (const file of files) {
            try {
                const layer = await DataHandler.loadFile(file);
                await DataHandler.saveLayer(layer);
                state.layers.push(layer);
                MapModule.addLayer(layer);

                // Fit to new layer bounds
                if (layer.bounds) {
                    MapModule.fitBounds(layer.bounds);
                }

                showToast(`Loaded: ${layer.name}`, 'success');
            } catch (error) {
                showToast(`Failed to load ${file.name}: ${error.message}`, 'error');
            }
        }

        renderLayersList();
        hideLoading();

        // Clear file input
        event.target.value = '';
    }

    /**
     * Handle search input
     */
    function handleSearch(event) {
        const query = event.target.value.trim();

        if (query.length < 2) {
            return;
        }

        const results = DataHandler.searchFeatures(state.layers, query);

        if (results.length > 0) {
            // Focus on first result
            const firstResult = results[0];
            const geometry = firstResult.feature.geometry;

            if (geometry) {
                let center;
                if (geometry.type === 'Point') {
                    center = geometry.coordinates;
                } else {
                    // Calculate centroid for other geometry types
                    const bounds = DataHandler.calculateBounds({
                        type: 'FeatureCollection',
                        features: [firstResult.feature]
                    });
                    if (bounds) {
                        center = [
                            (bounds[0][0] + bounds[1][0]) / 2,
                            (bounds[0][1] + bounds[1][1]) / 2
                        ];
                    }
                }

                if (center) {
                    MapModule.flyTo(center, 14);
                }
            }

            showToast(`Found ${results.length} result${results.length > 1 ? 's' : ''}`, 'success');
        } else {
            showToast('No results found', 'warning');
        }
    }

    /**
     * Handle locate button click
     */
    async function handleLocate() {
        elements.locateBtn.classList.add('active');

        try {
            const position = await MapModule.centerOnUser();
            updateLocationDisplay(position);

            if (!state.isTracking) {
                state.isTracking = true;
                MapModule.startTracking();
            }

            showToast('Location found', 'success');
        } catch (error) {
            let message = 'Could not get location';

            if (error.code === 1) {
                message = 'Location access denied';
            } else if (error.code === 2) {
                message = 'Location unavailable';
            } else if (error.code === 3) {
                message = 'Location request timed out';
            }

            showToast(message, 'error');
            elements.locateBtn.classList.remove('active');
        }
    }

    /**
     * Handle position update
     */
    function handlePositionUpdate(event) {
        const position = event.detail;
        updateLocationDisplay(position);
    }

    /**
     * Update location display in sidebar
     */
    function updateLocationDisplay(position) {
        elements.latValue.textContent = position.lat.toFixed(6);
        elements.lngValue.textContent = position.lng.toFixed(6);
        elements.accuracyValue.textContent = `${Math.round(position.accuracy)} m`;
    }

    /**
     * Handle position error
     */
    function handlePositionError(event) {
        console.error('Position error:', event.detail);
        elements.locateBtn.classList.remove('active');
    }

    /**
     * Handle merge and export all layers
     */
    function handleMergeExport() {
        if (state.layers.length === 0) {
            showToast('No layers to export', 'warning');
            return;
        }

        try {
            // Get all layer data
            const layerData = state.layers.map(layer => layer.data);

            // Merge using LayerUtils
            const merged = LayerUtils.mergeGeoJSON(layerData, 'merged_layers');

            // Download the merged file
            LayerUtils.downloadGeoJSON(merged, 'merged_layers.geojson');

            showToast(`Exported ${merged.features.length} features`, 'success');
        } catch (error) {
            console.error('Merge export failed:', error);
            showToast('Failed to export layers', 'error');
        }
    }

    /**
     * Handle feature click
     */
    function handleFeatureClick(event) {
        const { layerId, feature, lngLat } = event.detail;
        const layer = state.layers.find(l => l.id === layerId);

        showFeaturePopup(feature, layer);
    }

    /**
     * Show feature popup
     */
    function showFeaturePopup(feature, layer) {
        const properties = feature.properties || {};
        const title = properties.name || properties.title || layer?.name || 'Feature Details';

        elements.popupTitle.textContent = title;

        // Build properties HTML
        let html = '';
        for (const [key, value] of Object.entries(properties)) {
            if (value !== null && value !== undefined && key !== 'name' && key !== 'title') {
                html += `
                    <div class="property-row">
                        <span class="property-key">${formatPropertyKey(key)}</span>
                        <span class="property-value">${formatPropertyValue(value)}</span>
                    </div>
                `;
            }
        }

        if (html === '') {
            html = '<p style="color: var(--text-muted);">No properties available</p>';
        }

        elements.popupContent.innerHTML = html;
        elements.featurePopup.classList.remove('hidden');
    }

    /**
     * Hide feature popup
     */
    function hideFeaturePopup() {
        elements.featurePopup.classList.add('hidden');
    }

    /**
     * Format property key for display
     */
    function formatPropertyKey(key) {
        return key
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    /**
     * Format property value for display
     */
    function formatPropertyValue(value) {
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        if (typeof value === 'number') {
            return value.toLocaleString();
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    }

    /**
     * Toggle sidebar visibility
     */
    function toggleSidebar() {
        state.sidebarOpen = !state.sidebarOpen;
        updateSidebarState();
    }

    /**
     * Update sidebar state
     */
    function updateSidebarState() {
        elements.sidebar.classList.toggle('open', state.sidebarOpen);
    }

    /**
     * Handle window resize
     */
    function handleResize() {
        if (window.innerWidth >= 1024) {
            state.sidebarOpen = true;
        }
        updateSidebarState();
        MapModule.updateScaleBar();
    }

    /**
     * Handle keyboard shortcuts
     */
    function handleKeydown(event) {
        // Escape - close popup or sidebar
        if (event.key === 'Escape') {
            if (!elements.featurePopup.classList.contains('hidden')) {
                hideFeaturePopup();
            } else if (window.innerWidth < 1024 && state.sidebarOpen) {
                toggleSidebar();
            }
        }

        // Ctrl/Cmd + K - focus search
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            elements.searchInput.focus();
        }
    }

    /**
     * Update online/offline status
     */
    function updateOnlineStatus() {
        state.isOnline = navigator.onLine;
        const statusEl = elements.connectionStatus;
        const textEl = statusEl.querySelector('.status-text');

        if (state.isOnline) {
            statusEl.classList.remove('offline');
            statusEl.classList.add('online');
            textEl.textContent = 'Online';
        } else {
            statusEl.classList.remove('online');
            statusEl.classList.add('offline');
            textEl.textContent = 'Offline';
        }
    }

    /**
     * Render layers list
     */
    function renderLayersList() {
        if (state.layers.length === 0) {
            elements.layersList.innerHTML = `
                <p style="color: var(--text-muted); font-size: 0.875rem; text-align: center; padding: var(--spacing-md);">
                    No layers loaded. Import GeoJSON, KML, or GPX files to get started.
                </p>
            `;
            return;
        }

        elements.layersList.innerHTML = state.layers.map(layer => `
            <div class="layer-item ${layer.visible ? 'active' : ''}" data-layer-id="${layer.id}">
                <div class="layer-checkbox"></div>
                <span class="layer-color" style="background-color: ${layer.color}"></span>
                <span class="layer-name" title="${layer.name}">${layer.name}</span>
                <span class="layer-count">${layer.featureCount}</span>
                <button class="layer-delete" title="Remove layer" data-action="delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        `).join('');

        // Add event listeners
        elements.layersList.querySelectorAll('.layer-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const layerId = item.dataset.layerId;
                const action = e.target.closest('[data-action]')?.dataset.action;

                if (action === 'delete') {
                    deleteLayer(layerId);
                } else {
                    toggleLayerVisibility(layerId);
                }
            });
        });
    }

    /**
     * Toggle layer visibility
     */
    function toggleLayerVisibility(layerId) {
        const layer = state.layers.find(l => l.id === layerId);
        if (!layer) return;

        layer.visible = !layer.visible;

        if (layer.visible) {
            // Re-add layer to map when turning on (ensures it exists)
            MapModule.addLayer(layer);
        } else {
            MapModule.setLayerVisibility(layerId, false);
        }

        renderLayersList();
    }

    /**
     * Delete layer
     */
    async function deleteLayer(layerId) {
        const layer = state.layers.find(l => l.id === layerId);
        if (!layer) return;

        try {
            await DataHandler.deleteLayer(layerId);
            MapModule.removeLayer(layerId);
            state.layers = state.layers.filter(l => l.id !== layerId);
            renderLayersList();
            showToast(`Removed: ${layer.name}`, 'success');
        } catch (error) {
            showToast(`Failed to remove layer`, 'error');
        }
    }

    /**
     * Show loading overlay
     */
    function showLoading() {
        elements.loadingOverlay.classList.remove('hidden');
    }

    /**
     * Hide loading overlay
     */
    function hideLoading() {
        elements.loadingOverlay.classList.add('hidden');
    }

    /**
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;

        elements.toastContainer.appendChild(toast);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn var(--transition-normal) ease reverse';
            setTimeout(() => toast.remove(), 250);
        }, 4000);
    }

    /**
     * Register service worker for offline support
     */
    async function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('service-worker.js');
                console.log('Service Worker registered:', registration.scope);
            } catch (error) {
                console.log('Service Worker registration failed:', error);
            }
        }
    }

    /**
     * Debounce utility function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Public API
    return {
        init,
        showToast,
        showLoading,
        hideLoading
    };
})();

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
