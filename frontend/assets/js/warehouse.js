/* Warehouse page logic */
(function () {
  const apiBase = window.__getApiBase?.() || window.API_BASE_URL || 'http://localhost:4000';

  const grid = document.getElementById('warehousesGrid');
  const select = document.getElementById('assignWarehouse');
  const trackingInput = document.getElementById('assignTracking');
  const assignBtn = document.getElementById('assignBtn');
  const createWarehouseBtn = document.getElementById('createWarehouseBtn');
  const hint = document.getElementById('assignHint');

  if (!grid || !select || !trackingInput || !assignBtn) return;

  function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function fetchJson(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || 'Request failed');
    return data;
  }

  function countShipmentsByWarehouse(shipments) {
    return (shipments || []).reduce((map, shipment) => {
      const id = String(shipment.warehouseId?._id || shipment.warehouseId || '');
      if (!id) return map;
      map[id] = (map[id] || 0) + 1;
      return map;
    }, {});
  }

  function renderWarehouses(list, shipments) {
    const items = list || [];
    const assignedCounts = countShipmentsByWarehouse(shipments);
    select.innerHTML = items
      .map((warehouse) => `<option value="${escapeHtml(warehouse._id)}">${escapeHtml(warehouse.name)}</option>`)
      .join('');

    grid.innerHTML = items.length
      ? items.map((warehouse) => {
          const inventory = warehouse.inventory || {};
          const total = Number(warehouse.capacity || inventory.total || 0);
          const used = Number(warehouse.occupancy || inventory.used || assignedCounts[String(warehouse._id)] || 0);
          const capacityLabel = total > 0 ? `${Math.max(total - used, 0)} open slots` : 'Capacity not set';
          const assignedLabel = `${assignedCounts[String(warehouse._id)] || 0} assigned shipments`;
          return `
            <div class="warehouse-card">
              <div class="warehouse-top">
                <div>
                  <div class="warehouse-name">${escapeHtml(warehouse.name)}</div>
                  <div class="muted">${escapeHtml([warehouse.city, warehouse.country].filter(Boolean).join(', '))}</div>
                </div>
                <div class="chip">${escapeHtml(used)}/${escapeHtml(total || 'N/A')}</div>
              </div>
              <div class="warehouse-body">
                <div class="warehouse-row"><span class="muted">Assigned</span><b>${escapeHtml(assignedLabel)}</b></div>
                <div class="warehouse-row"><span class="muted">Capacity</span><b>${escapeHtml(capacityLabel)}</b></div>
                <div class="warehouse-row"><span class="muted">Incoming</span><b>${escapeHtml(warehouse.incomingShipments || 0)} shipments</b></div>
                <div class="warehouse-row"><span class="muted">Outgoing</span><b>${escapeHtml(warehouse.outgoingShipments || 0)} shipments</b></div>
                <div class="warehouse-row"><span class="muted">Pending</span><b>${escapeHtml(warehouse.pendingShipments || 0)} shipments</b></div>
                <div class="warehouse-row"><span class="muted">Delay score</span><b>${escapeHtml(warehouse.hubDelayScore || 0)} / 100</b></div>
                <div class="warehouse-row"><span class="muted">Risk</span><b>${escapeHtml(warehouse.riskLevel || 'Low')}</b></div>
                <div class="warehouse-row"><span class="muted">Inventory</span><b>${escapeHtml(inventory.summary || 'Available')}</b></div>
                <div class="warehouse-row"><span class="muted">Location</span><b>${escapeHtml(warehouse.address || '-')}</b></div>
                <button class="table-action" type="button" data-select-warehouse="${escapeHtml(warehouse._id)}">Use this hub</button>
              </div>
            </div>
          `;
        }).join('')
      : '<div class="empty-state"><strong>No warehouses yet</strong><span>Create a warehouse so shipments can be assigned to a hub.</span></div>';
  }

  async function assignShipment() {
    const warehouseId = select.value;
    const trackingNumber = trackingInput.value.trim();

    if (!warehouseId) {
      if (hint) hint.textContent = 'No warehouse available';
      return;
    }

    if (!trackingNumber) {
      if (hint) hint.textContent = 'Enter tracking number';
      return;
    }

    assignBtn.disabled = true;
    if (hint) hint.textContent = 'Assigning...';

    try {
      await fetchJson('/api/shipments/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, warehouseId, status: 'In Transit' }),
      });
      if (hint) hint.textContent = 'Assigned successfully';
      trackingInput.value = '';
      await loadWarehouses();
      window.__showToast?.('Shipment assigned');
    } catch (error) {
      if (hint) hint.textContent = error.message;
    } finally {
      assignBtn.disabled = false;
    }
  }

  async function createWarehouse() {
    const name = document.getElementById('warehouseName')?.value?.trim();
    const address = document.getElementById('warehouseAddress')?.value?.trim();
    const city = document.getElementById('warehouseCity')?.value?.trim();
    const country = document.getElementById('warehouseCountry')?.value?.trim();
    const capacity = document.getElementById('warehouseCapacity')?.value;
    const occupancy = document.getElementById('warehouseOccupancy')?.value;
    const hubDelayScore = document.getElementById('warehouseDelayScore')?.value;
    const riskLevel = document.getElementById('warehouseRiskLevel')?.value;

    if (!name) {
      window.__showToast?.('Warehouse name is required');
      return;
    }

    createWarehouseBtn.disabled = true;
    try {
      await fetchJson('/api/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, address, city, country, capacity, occupancy, hubDelayScore, riskLevel }),
      });

      ['warehouseName', 'warehouseAddress', 'warehouseCity', 'warehouseCountry', 'warehouseCapacity', 'warehouseOccupancy', 'warehouseDelayScore'].forEach((id) => {
        const input = document.getElementById(id);
        if (input) input.value = '';
      });

      const [warehousesData, shipmentsData] = await Promise.all([
        fetchJson('/api/warehouses'),
        fetchJson('/api/shipments'),
      ]);
      renderWarehouses(warehousesData.items || warehousesData.warehouses || [], shipmentsData.items || shipmentsData.shipments || []);
      window.__showToast?.('Warehouse created');
    } catch (error) {
      window.__showToast?.(error.message);
    } finally {
      createWarehouseBtn.disabled = false;
    }
  }

  async function loadWarehouses() {
    try {
      const [warehousesData, shipmentsData] = await Promise.all([
        fetchJson('/api/warehouses'),
        fetchJson('/api/shipments'),
      ]);
      renderWarehouses(warehousesData.items || warehousesData.warehouses || [], shipmentsData.items || shipmentsData.shipments || []);
    } catch (error) {
      if (hint) hint.textContent = error.message;
    }
  }

  async function init() {
    if (!localStorage.getItem('token')) {
      location.href = './login.html';
      return;
    }

    await loadWarehouses();
  }

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-select-warehouse]');
    if (!button) return;
    select.value = button.dataset.selectWarehouse;
    trackingInput.focus();
    if (hint) hint.textContent = 'Enter a tracking number to assign to this hub.';
  });

  assignBtn.addEventListener('click', assignShipment);
  createWarehouseBtn?.addEventListener('click', createWarehouse);
  init();
})();
