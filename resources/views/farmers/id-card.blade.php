<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Farmer ID — {{ $farmer->last_name }}, {{ $farmer->first_name }}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #eef2ee;
    display: flex;
    flex-wrap: wrap;
    gap: 40px;
    padding: 40px;
    justify-content: center;
    align-items: flex-start;
  }

  /* Both cards are CR80 (the standard ID size) at 96dpi, so what prints
     matches the plastic it is mounted on. */
  .card {
    width: 380px;
    height: 240px;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.18);
    position: relative;
    background: #ffffff;
  }

  /* ===== FRONT ===== */
  .card-front { display: flex; flex-direction: column; }

  .header {
    background: linear-gradient(135deg, #1f6d3c 0%, #2f8f4e 60%, #3fae5f 100%);
    color: #fff;
    padding: 12px 16px 10px;
    position: relative;
    overflow: hidden;
  }
  .header::after {
    content: "";
    position: absolute;
    right: -30px; top: -30px;
    width: 100px; height: 100px;
    background: rgba(255,255,255,0.08);
    border-radius: 50%;
  }
  .header-top { display: flex; align-items: center; gap: 10px; }
  .seal {
    width: 34px; height: 34px;
    border-radius: 50%;
    background: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; color: #1f6d3c; font-weight: 800;
    flex-shrink: 0;
  }
  .header-text { line-height: 1.15; }
  .header-text .muni {
    font-size: 8px; letter-spacing: .4px; text-transform: uppercase;
    opacity: .9; line-height: 1.3;
  }
  .header-text .title { font-size: 13px; font-weight: 700; letter-spacing: .3px; }
  .header-text .sub { font-size: 9px; opacity: .85; margin-top: 1px; }

  .body { flex: 1; display: flex; padding: 14px 16px; gap: 14px; min-height: 0; }

  .photo-box {
    width: 84px; height: 100px;
    border-radius: 8px;
    background: #e3ede4;
    border: 2px solid #2f8f4e;
    display: flex; align-items: center; justify-content: center;
    color: #7fa98a; font-size: 10px; text-align: center;
    flex-shrink: 0; overflow: hidden;
  }
  .photo-box img { width: 100%; height: 100%; object-fit: cover; display: block; }

  .info { flex: 1; min-width: 0; }
  .name {
    font-size: 15px; font-weight: 800; color: #17331f;
    letter-spacing: .2px; line-height: 1.2;
    /* A long Filipino compound surname must not push the badge off the card. */
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .role-badge {
    display: inline-block; margin-top: 4px;
    background: #dff2e3; color: #1f6d3c;
    font-size: 9px; font-weight: 700;
    padding: 2px 8px; border-radius: 20px; letter-spacing: .4px;
  }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; margin-top: 6px; }
  .info-row { font-size: 9.5px; color: #3c4a3f; min-width: 0; }
  .info-row .label {
    display: block; font-size: 8px; text-transform: uppercase;
    letter-spacing: .4px; color: #7c9080; margin-bottom: 1px;
  }
  .info-row .value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .span-2 { grid-column: 1 / -1; }

  .footer-strip {
    background: #f4f9f5;
    border-top: 1px dashed #bcd9c3;
    padding: 6px 16px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .id-no { font-size: 9px; color: #1f6d3c; font-weight: 700; letter-spacing: .5px; }
  .valid { font-size: 8px; color: #7c9080; }

  /* ===== BACK ===== */
  .card-back { display: flex; flex-direction: column; padding: 16px; }
  .back-header {
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 2px solid #2f8f4e; padding-bottom: 8px; margin-bottom: 12px;
  }
  .back-header .title {
    font-size: 11px; font-weight: 800; color: #1f6d3c;
    text-transform: uppercase; letter-spacing: .4px;
  }
  .back-header .ref { font-size: 8px; color: #7c9080; }

  .back-content { display: flex; gap: 16px; flex: 1; min-height: 0; }
  .qr-box {
    width: 100px; height: 100px;
    border: 3px solid #17331f; border-radius: 6px;
    flex-shrink: 0; padding: 4px; background: #fff;
    display: flex; align-items: center; justify-content: center;
  }
  /* The stored QR is an SVG, so it stays sharp at print resolution. */
  .qr-box svg { width: 100%; height: 100%; display: block; }

  .back-details { flex: 1; font-size: 9px; color: #3c4a3f; line-height: 1.5; min-width: 0; }
  .back-details .line {
    display: flex; justify-content: space-between; gap: 8px;
    border-bottom: 1px solid #e3ede4; padding: 3px 0;
  }
  .back-details .line span:first-child { color: #7c9080; white-space: nowrap; }
  .back-details .line span:last-child {
    font-weight: 600; color: #17331f;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .signature-strip {
    margin-top: 12px; display: flex; justify-content: space-between; gap: 6px;
    font-size: 6.8px; color: #7c9080; text-align: center;
  }
  .signature-strip div { border-top: 1px solid #bcd9c3; padding-top: 3px; width: 31%; }
  .note { margin-top: auto; font-size: 7px; color: #9aab9c; text-align: center; padding-top: 8px; }

  .label-tag {
    text-align: center; font-size: 12px; color: #4a5a4c;
    font-weight: 600; width: 380px;
  }
  .stack { display: flex; flex-direction: column; align-items: center; gap: 10px; }

  .toolbar {
    position: fixed; top: 12px; right: 12px; display: flex; gap: 8px; z-index: 10;
  }
  .toolbar button, .toolbar a {
    background: #1f6d3c; color: #fff; border: 0; border-radius: 6px;
    padding: 8px 14px; font: 600 12px 'Segoe UI', Arial, sans-serif;
    cursor: pointer; text-decoration: none;
  }
  .toolbar a { background: #fff; color: #1f6d3c; border: 1px solid #bcd9c3; }

  @media print {
    /* Landscape so both cards sit side by side on one sheet. */
    @page { size: A4 landscape; margin: 12mm; }
    body { background: #fff; padding: 0; gap: 24px; }
    .toolbar, .label-tag { display: none !important; }
    .card {
      box-shadow: none;
      border: 1px solid #cbd9cd;   /* a cutting line once the shadow is gone */
      break-inside: avoid; page-break-inside: avoid;
    }
  }
</style>
</head>
<body>

<div class="toolbar">
  <button onclick="window.print()">Print</button>
  <a href="/admin/farmers/{{ $farmer->id }}">Back to profile</a>
</div>

@php
  $mi = $farmer->middle_name ? strtoupper(substr($farmer->middle_name, 0, 1)) . '.' : '';
  $displayName = trim(collect([$farmer->first_name, $mi, $farmer->last_name, $farmer->suffix])
      ->filter()->implode(' '));
@endphp

<div class="stack">
  <div class="label-tag">FRONT</div>
  <div class="card card-front">
    <div class="header">
      <div class="header-top">
        <div class="seal">&#127806;</div>
        <div class="header-text">
          <div class="muni">Registry System for Basic Sectors in Agriculture (RSBSA)</div>
          <div class="title">Farmer Identification Card</div>
          <div class="sub">Municipal Agriculture Office &middot; Tumauini, Isabela</div>
        </div>
      </div>
    </div>

    <div class="body">
      <div class="photo-box">
        @if ($photoData)
          <img src="{{ $photoData }}" alt="">
        @else
          NO PHOTO
        @endif
      </div>

      <div class="info">
        <div class="name" title="{{ $displayName }}">{{ $displayName }}</div>
        <span class="role-badge">REGISTERED FARMER</span>

        <div class="info-grid">
          <div class="info-row">
            <span class="label">Barangay</span>
            <span class="value">{{ $farmer->barangay ?: '—' }}</span>
          </div>
          <div class="info-row">
            <span class="label">Farmer Type</span>
            <span class="value">{{ $farmerType }}</span>
          </div>
          <div class="info-row span-2">
            <span class="label">RSBSA Ref. No.</span>
            <span class="value">{{ $farmer->rsbsa_no ?: ($farmer->reference_code ?: 'Not yet issued') }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="footer-strip">
      <div class="id-no">ID NO. {{ $idNumber }}</div>
      <div class="valid">Valid until: {{ $validUntil->format('m/Y') }}</div>
    </div>
  </div>
</div>

<div class="stack">
  <div class="label-tag">BACK</div>
  <div class="card card-back">
    <div class="back-header">
      <div class="title">Scan to Verify</div>
      <div class="ref">{{ $idNumber }}</div>
    </div>

    <div class="back-content">
      <div class="qr-box">{!! $qrSvg !!}</div>

      <div class="back-details">
        <div class="line"><span>Middle Name</span><span>{{ $farmer->middle_name ?: '—' }}</span></div>
        <div class="line"><span>Extension</span><span>{{ $farmer->suffix ?: '—' }}</span></div>
        <div class="line"><span>City/Municipality</span><span>{{ $farmer->city_municipality ?: 'Tumauini' }}</span></div>
        <div class="line"><span>Province</span><span>{{ $farmer->province ?: 'Isabela' }}</span></div>
        <div class="line"><span>Status</span><span>{{ ucfirst($farmer->verification_status) }}</span></div>
      </div>
    </div>

    <div class="signature-strip">
      <div>Barangay Chairman</div>
      <div>City/Municipal Agri. Officer</div>
      <div>CARC MARC Chairman</div>
    </div>

    <div class="note">
      This card remains property of the Municipal Agriculture Office. If found, please return.
    </div>
  </div>
</div>

</body>
</html>
