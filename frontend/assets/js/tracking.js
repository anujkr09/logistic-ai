/* Tracking page wiring */
(function () {
  const form = document.getElementById('trackingForm');
  const input = document.getElementById('trackingNumberInput');
  const error = document.getElementById('trackingError');

  if (!form || !input) return;

  const apiBase = window.__getApiBase?.() || window.API_BASE_URL || 'http://localhost:4000';
  const tdTracking = document.getElementById('tdTracking');
  const tdStatus = document.getElementById('tdStatus');
  const tdStage = document.getElementById('tdStage');
  const tdType = document.getElementById('tdType');
  const tdPriority = document.getElementById('tdPriority');
  const tdWeight = document.getElementById('tdWeight');
  const tdDimensions = document.getElementById('tdDimensions');
  const tdPackages = document.getElementById('tdPackages');
  const tdOrigin = document.getElementById('tdOrigin');
  const tdDestination = document.getElementById('tdDestination');
  const tdLocation = document.getElementById('tdLocation');
  const tdUpdated = document.getElementById('tdUpdated');
  const tdCreated = document.getElementById('tdCreated');
  const tdRoute = document.getElementById('tdRoute');
  const tdMode = document.getElementById('tdMode');
  const tdWeather = document.getElementById('tdWeather');
  const tdDelay = document.getElementById('tdDelay');
  const tdETA = document.getElementById('tdETA');
  const tdConfidence = document.getElementById('tdConfidence');
  const tdCovered = document.getElementById('tdCovered');
  const tdRemaining = document.getElementById('tdRemaining');
  const tdExpectedDelay = document.getElementById('tdExpectedDelay');
  const tdVehicle = document.getElementById('tdVehicle');
  const tdDriver = document.getElementById('tdDriver');
  const tdGps = document.getElementById('tdGps');
  const tdSender = document.getElementById('tdSender');
  const tdPickupAddress = document.getElementById('tdPickupAddress');
  const tdPickupContact = document.getElementById('tdPickupContact');
  const tdReceiver = document.getElementById('tdReceiver');
  const tdDeliveryAddress = document.getElementById('tdDeliveryAddress');
  const tdDeliveryContact = document.getElementById('tdDeliveryContact');
  const documentActions = document.getElementById('documentActions');
  const aiSummary = document.getElementById('aiSummary');
  const timeline = document.getElementById('timeline');
  const notifications = document.getElementById('notifications');
  const progressBar = document.getElementById('progressBar');
  const progressLabel = document.getElementById('progressLabel');
  const dashboardNavLink = document.getElementById('dashboardNavLink');
  const fraudReportForm = document.getElementById('fraudReportForm');
  const fraudDescription = document.getElementById('fraudDescription');
  const fraudSuspectedParty = document.getElementById('fraudSuspectedParty');
  const fraudReportStatus = document.getElementById('fraudReportStatus');
  const trackingViewerBadge = document.getElementById('trackingViewerBadge');
  const trackingViewerInitials = document.getElementById('trackingViewerInitials');
  const trackingViewerName = document.getElementById('trackingViewerName');
  const trackingViewerRole = document.getElementById('trackingViewerRole');
  const trackingChatContext = document.getElementById('trackingChatContext');
  let activeTrackingNumber = '';
  let activeShipmentSnapshot = null;

  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'G';
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  }

  function roleLabel(role) {
    if (role === 'admin') return 'Admin tracking';
    if (role === 'warehouse_manager') return 'Warehouse manager tracking';
    if (role === 'customer') return 'Customer tracking';
    return 'Tracking viewer';
  }

  function renderViewerBadge() {
    if (!trackingViewerBadge) return;
    const user = getStoredUser();
    const role = user.role || localStorage.getItem('userRole') || '';
    const name = user.name || user.email || (localStorage.getItem('token') ? 'Logged in user' : 'Guest');

    trackingViewerInitials.textContent = initials(name);
    trackingViewerName.textContent = name;
    trackingViewerRole.textContent = roleLabel(role);
    trackingViewerBadge.hidden = false;

    window.__ZYRAVIQ_TRACKING_CONTEXT__ = {
      ...(window.__ZYRAVIQ_TRACKING_CONTEXT__ || {}),
      viewerName: name,
      viewerRole: role || 'guest',
      viewerRoleLabel: roleLabel(role),
    };
    if (trackingChatContext) trackingChatContext.textContent = `${roleLabel(role)} ready`;
  }

  function compactHistory(history = []) {
    return (Array.isArray(history) ? history : []).slice(-8).map((entry) => ({
      status: entry.status || '',
      at: entry.at || entry.timestamp || entry.meta?.statusUpdatedAt || '',
      location: locationText(entry.location),
      progressPercent: entry.progressPercent ?? entry.meta?.autoProgress ?? null,
      detail: entry.detail || entry.meta?.note || '',
    }));
  }

  function buildTrackingSnapshot(shipment = {}) {
    const insights = shipment.aiInsights || {};
    const delay = insights.delay || {};
    return {
      trackingNumber: shipment.trackingNumber || activeTrackingNumber || '',
      status: shipment.status || '',
      route: {
        origin: locationText(shipment.origin),
        current: locationText(shipment.currentLocation),
        destination: locationText(shipment.destination),
        summary: insights.routeSummary || `${locationText(shipment.origin)} -> ${locationText(shipment.destination)}`,
      },
      eta: shipment.estimatedDelivery || '',
      etaConfidence: insights.etaConfidence || null,
      progressPercent: insights.progressPercent ?? null,
      transportMode: insights.transportMode || null,
      weather: insights.weather || null,
      delay: {
        isDelayed: Boolean(delay.isDelayed),
        severity: delay.severity || 'None',
        reason: delay.reason || '',
      },
      fraud: {
        isFlagged: Boolean(shipment.fraud?.isFlagged),
        riskScore: shipment.fraud?.riskScore ?? 0,
        alerts: shipment.fraud?.alerts || [],
      },
      routeStops: compactHistory(insights.timeline || shipment.history || []),
      aiSummary: insights.aiSummary || '',
      reportStatus: fraudReportStatus?.textContent || '',
    };
  }

  function setupRoleNav() {
    if (!dashboardNavLink) return;
    dashboardNavLink.href = './tracking.html';
    dashboardNavLink.textContent = 'Tracking';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function locationText(location) {
    if (!location) return '-';
    return location.text || [location.city, location.country].filter(Boolean).join(', ') || '-';
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
  }

  function formatRelative(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.max(0, Math.round(diffMs / 60000));
    if (minutes < 2) return 'Just now';
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    return formatDate(value);
  }

  function formatDimensions(dimensions = {}) {
    const parts = [dimensions.length, dimensions.width, dimensions.height].map((item) => Number(item || 0)).filter((item) => item > 0);
    return parts.length ? `${parts.join(' x ')} ${dimensions.unit || 'cm'}` : '-';
  }

  function formatDelay(minutes) {
    const value = Number(minutes || 0);
    if (!value) return 'No expected delay';
    const hours = Math.floor(value / 60);
    const mins = value % 60;
    return [hours ? `${hours} hr` : '', mins ? `${mins} min` : ''].filter(Boolean).join(' ');
  }

  function renderDocuments(shipment) {
    if (!documentActions) return;
    const docs = Array.isArray(shipment.documents) ? shipment.documents : [];
    documentActions.innerHTML = docs.length
      ? docs.map((doc) => `<a class="doc-action" href="${escapeHtml(apiBase)}${escapeHtml(doc.url)}" target="_blank" rel="noopener">${escapeHtml(doc.label)}</a>`).join('')
      : '<span class="muted">Documents will appear after tracking loads.</span>';
  }

  function renderTimeline(history, insights) {
    if (!timeline) return;
    const items = insights?.timeline || history || [];
    timeline.innerHTML = items.length
      ? items.map((entry, index) => `
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-title">${escapeHtml(entry.status || 'Update')}${index === 0 ? ' (latest)' : ''}</div>
              <div class="timeline-meta">${escapeHtml(formatDate(entry.at || entry.timestamp))}</div>
              <div class="timeline-sub">${escapeHtml(locationText(entry.location))}</div>
              ${entry.progressPercent != null ? `<div class="timeline-chip">${escapeHtml(entry.progressPercent)}% route completed</div>` : ''}
              ${entry.description ? `<div class="timeline-detail">${escapeHtml(entry.description)}</div>` : ''}
              ${entry.detail ? `<div class="timeline-detail">${escapeHtml(entry.detail)}</div>` : ''}
            </div>
          </div>
        `).join('')
      : '<div class="muted">No history yet.</div>';
  }

  function renderProgress(status, insights) {
    if (!progressBar || !progressLabel) return;
    const steps = ['Shipment Created', 'Pickup Scheduled', 'Picked Up', 'At Origin Hub', 'Departed Origin Hub', 'In Transit', 'At Destination Hub', 'Out For Delivery', 'Delivered'];
    const index = Math.max(0, steps.findIndex((step) => step.toLowerCase() === String(status || '').toLowerCase()));
    const insightPercent = Number(insights?.progressPercent);
    const percent = Number.isFinite(insightPercent) ? insightPercent : (index / (steps.length - 1)) * 100;
    progressBar.style.setProperty('--progress', `${percent}%`);
    progressLabel.textContent = `${status || '-'} - ${Math.round(percent)}%`;
  }

  function renderNotification(notification) {
    if (!notifications || !notification) return;
    notifications.insertAdjacentHTML('afterbegin', `
      <div class="notif-item ${notification.type === 'fraud_alert' ? 'alert-danger' : ''}">
        <div class="notif-title">${escapeHtml(notification.title || 'Notification')}</div>
        <div class="notif-body">${escapeHtml(notification.message || '')}</div>
      </div>
    `);
  }

  function setShipmentUI(shipment) {
    if (!shipment) return;
    const insights = shipment.aiInsights || {};
    const mode = insights.transportMode;
    const weather = insights.weather;
    const delay = insights.delay;
    activeTrackingNumber = shipment.trackingNumber || activeTrackingNumber;
    activeShipmentSnapshot = buildTrackingSnapshot(shipment);
    window.__ZYRAVIQ_TRACKING_CONTEXT__ = {
      ...(window.__ZYRAVIQ_TRACKING_CONTEXT__ || {}),
      trackingNumber: activeTrackingNumber,
      shipmentStatus: shipment.status || '',
      currentLocation: locationText(shipment.currentLocation),
      screen: activeShipmentSnapshot,
    };
    if (trackingChatContext) {
      trackingChatContext.textContent = `${activeTrackingNumber} - ${shipment.status || 'Tracking loaded'}`;
    }
    tdTracking.textContent = shipment.trackingNumber || '-';
    tdStatus.textContent = shipment.status || '-';
    if (tdStage) tdStage.textContent = shipment.currentStage || insights.currentStage || shipment.status || '-';
    if (tdType) tdType.textContent = shipment.shipmentType || '-';
    if (tdPriority) tdPriority.textContent = shipment.priority || '-';
    if (tdWeight) tdWeight.textContent = shipment.weight ? `${shipment.weight} kg` : '-';
    if (tdDimensions) tdDimensions.textContent = formatDimensions(shipment.dimensions);
    if (tdPackages) tdPackages.textContent = shipment.packageCount || '-';
    if (tdOrigin) tdOrigin.textContent = locationText(shipment.origin);
    if (tdDestination) tdDestination.textContent = locationText(shipment.destination);
    tdLocation.textContent = insights.currentLocationText || locationText(shipment.currentLocation);
    if (tdUpdated) tdUpdated.textContent = formatDate(shipment.updatedAt);
    if (tdCreated) tdCreated.textContent = formatDate(shipment.createdAt);
    if (tdRoute) tdRoute.textContent = insights.routeSummary || `${locationText(shipment.origin)} -> ${locationText(shipment.destination)}`;
    tdETA.textContent = shipment.estimatedDelivery ? formatDate(shipment.estimatedDelivery) : '-';
    if (tdDelay) tdDelay.textContent = delay ? `${delay.severity}: ${delay.reason}` : '-';
    if (tdConfidence) tdConfidence.textContent = (shipment.logistics?.deliveryConfidence || insights.etaConfidence) ? `${shipment.logistics?.deliveryConfidence || insights.etaConfidence}% confidence` : '-';
    if (tdCovered) tdCovered.textContent = shipment.logistics?.coveredDistanceKm != null ? `${shipment.logistics.coveredDistanceKm} KM` : '-';
    if (tdRemaining) tdRemaining.textContent = shipment.logistics?.remainingDistanceKm != null ? `${shipment.logistics.remainingDistanceKm} KM` : '-';
    if (tdExpectedDelay) tdExpectedDelay.textContent = formatDelay(shipment.logistics?.expectedDelayMinutes || insights.expectedDelayMinutes);
    if (tdVehicle) tdVehicle.textContent = shipment.vehicle?.number ? `${shipment.vehicle.number}${shipment.vehicle.type ? ` (${shipment.vehicle.type})` : ''}` : 'Unassigned';
    if (tdDriver) tdDriver.textContent = shipment.driver?.name ? `${shipment.driver.name}${shipment.driver.phone ? `, ${shipment.driver.phone}` : ''}` : 'Unassigned';
    if (tdGps) tdGps.textContent = formatRelative(shipment.logistics?.lastGpsPingAt || insights.lastGpsPingAt);
    const customer = shipment.customerView || {};
    if (tdSender) tdSender.textContent = customer.senderName || '-';
    if (tdPickupAddress) tdPickupAddress.textContent = customer.pickupAddress || '-';
    if (tdPickupContact) tdPickupContact.textContent = [customer.pickupContact, customer.senderPhone, customer.senderEmail].filter(Boolean).join(' | ') || '-';
    if (tdReceiver) tdReceiver.textContent = customer.receiverName || '-';
    if (tdDeliveryAddress) tdDeliveryAddress.textContent = customer.deliveryAddress || '-';
    if (tdDeliveryContact) tdDeliveryContact.textContent = [customer.receiverPhone, customer.receiverEmail].filter(Boolean).join(' | ') || '-';
    if (aiSummary) aiSummary.textContent = insights.aiSummary || 'AI analysis is waiting for the next route scan.';
    renderTimeline(shipment.routeHistory || shipment.history, { ...insights, timeline: shipment.routeHistory || insights.timeline });
    renderProgress(shipment.status, insights);
    renderDocuments(shipment);
    window.__MAP_UPDATE?.(shipment.currentLocation, shipment);
    const mapDetails = window.__MAP_DETAILS || {};
    if (tdMode) tdMode.textContent = mode ? `${mode.label} - ${mode.detail}` : (mapDetails.mode ? `${mapDetails.mode.label} - ${mapDetails.mode.detail}` : '-');
    if (tdWeather) tdWeather.textContent = weather ? `${weather.label}, ${weather.temp}C at ${weather.location} - ${weather.detail}` : (mapDetails.weather ? `${mapDetails.weather.label}, ${mapDetails.weather.temp}C - ${mapDetails.weather.detail}` : '-');
  }

  function subscribeTracking(trackingNumber) {
    window.__TRACKING_SUBSCRIBE?.(trackingNumber, (payload) => {
      if (payload?.shipment) setShipmentUI(payload.shipment);
      if (payload?.notification) renderNotification(payload.notification);
    });
  }

  async function loadTracking(trackingNumber) {
    if (!trackingNumber) return;
    if (error) {
      error.textContent = 'Checking shipment status...';
      error.classList.add('is-loading');
    }

    try {
      const response = await fetch(`${apiBase}/api/shipments/track/${encodeURIComponent(trackingNumber)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Tracking not found');

      setShipmentUI(data);
      subscribeTracking(trackingNumber);
      if (error) {
        error.classList.remove('is-loading');
        error.textContent = '';
      }
      window.__showToast?.('Tracking loaded');
    } catch (err) {
      if (error) {
        error.classList.remove('is-loading');
        const message = err?.message || 'Error';
        error.textContent = message === 'Shipment not found'
          ? 'Tracking number nahi mila. Exact number check karo, ya admin dashboard se pehle shipment create karo.'
          : message;
      }
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    loadTracking(input.value.trim());
  });

  fraudReportForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = localStorage.getItem('token');
    const trackingNumber = activeTrackingNumber || input.value.trim();
    const description = fraudDescription?.value.trim();

    if (!token) {
      if (fraudReportStatus) fraudReportStatus.textContent = 'Please sign in before reporting fraud.';
      return;
    }
    if (!trackingNumber || !description) {
      if (fraudReportStatus) fraudReportStatus.textContent = 'Load a tracking number and describe the suspicious activity.';
      return;
    }

    const button = fraudReportForm.querySelector('button[type="submit"]');
    button.disabled = true;
    if (fraudReportStatus) fraudReportStatus.textContent = 'Submitting report...';
    try {
      const response = await fetch(`${apiBase}/api/fraud/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          trackingNumber,
          description,
          suspectedParty: fraudReportForm.querySelector('input[name="fraudType"]:checked')?.value || fraudSuspectedParty?.value || 'unknown',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Could not submit report');
      fraudDescription.value = '';
      if (fraudReportStatus) fraudReportStatus.textContent = 'Fraud report sent to admin and affected customer.';
      window.__ZYRAVIQ_TRACKING_CONTEXT__ = {
        ...(window.__ZYRAVIQ_TRACKING_CONTEXT__ || {}),
        screen: {
          ...(activeShipmentSnapshot || {}),
          reportStatus: fraudReportStatus?.textContent || '',
          lastFraudReport: {
            trackingNumber,
            suspectedParty: fraudReportForm.querySelector('input[name="fraudType"]:checked')?.value || fraudSuspectedParty?.value || 'unknown',
            submitted: true,
          },
        },
      };
      renderNotification({
        type: 'fraud_alert',
        title: 'Fraud report submitted',
        message: `Report for ${trackingNumber} has been sent for review.`,
      });
    } catch (err) {
      if (fraudReportStatus) fraudReportStatus.textContent = err?.message || 'Could not submit report';
    } finally {
      button.disabled = false;
    }
  });

  setupRoleNav();
  renderViewerBadge();
  window.__MAP_INIT?.();
  const initialTracking = new URLSearchParams(location.search).get('tracking');
  if (initialTracking) {
    input.value = initialTracking;
    loadTracking(initialTracking);
  }
})();
