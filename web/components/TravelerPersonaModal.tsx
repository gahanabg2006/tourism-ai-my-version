"use client";

import React, { useState, useMemo } from "react";
import {
  ShieldCheck, Globe, CheckCircle2, AlertTriangle, ExternalLink,
  Camera, FileText, Plane, CreditCard, ArrowRight, ArrowLeft, Search, X
} from "lucide-react";
import {
  COUNTRY_VISA_RULES,
  getCountryVisaRule,
  OFFICIAL_GOV_VISA_URL,
  MANDATORY_FOREIGN_DOCUMENTS,
  type CountryVisaRule
} from "../lib/visa-rules";

interface TravelerPersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIndian: () => void;
  onConfirmForeign: (country: string, visaRule: CountryVisaRule) => void;
  currentType?: "indian" | "foreign" | null;
  currentCountry?: string;
}

export default function TravelerPersonaModal({
  isOpen,
  onClose,
  onSelectIndian,
  onConfirmForeign,
  currentType,
  currentCountry = "United States",
}: TravelerPersonaModalProps) {
  const [step, setStep] = useState<"persona" | "foreign_details">(
    currentType === "foreign" ? "foreign_details" : "persona"
  );
  const [searchCountry, setSearchCountry] = useState("");
  const [selectedCountryName, setSelectedCountryName] = useState<string>(currentCountry);

  const activeVisaRule = useMemo(() => {
    return getCountryVisaRule(selectedCountryName);
  }, [selectedCountryName]);

  const popularCountries = useMemo(() => {
    return Object.values(COUNTRY_VISA_RULES);
  }, []);

  const filteredCountries = useMemo(() => {
    if (!searchCountry.trim()) return popularCountries;
    const q = searchCountry.toLowerCase().trim();
    return popularCountries.filter(
      c => c.country.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [searchCountry, popularCountries]);

  if (!isOpen) return null;

  return (
    <div className="persona-modal-overlay">
      <div className="persona-modal-container">
        {/* Close Button if user is just switching */}
        {currentType && (
          <button className="persona-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        )}

        {/* ── STEP 1: Persona Choice (Indian Citizen vs Foreign Visitor) ── */}
        {step === "persona" && (
          <div className="persona-step-wrap">
            <div className="persona-header">
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <img
                  src="/logo.png"
                  alt="Touristमत्रम् Logo"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    border: "1.5px solid rgba(255, 200, 61, 0.4)",
                    boxShadow: "0 4px 16px rgba(255, 200, 61, 0.25)",
                    objectFit: "contain",
                  }}
                />
              </div>
              <div className="persona-badge">
                <ShieldCheck size={14} color="var(--yellow)" />
                <span>Touristमत्रम् · Personalized Travel Protection</span>
              </div>
              <h2 className="persona-title">Welcome to India</h2>
              <p className="persona-sub">
                Please select your traveler category to customize your itinerary, transit passes, and official entry verification.
              </p>
            </div>

            <div className="persona-cards-grid">
              {/* Option A: Indian Citizen */}
              <div
                className={`persona-option-card ${currentType === "indian" ? "selected" : ""}`}
                onClick={onSelectIndian}
              >
                <div className="persona-card-flag">🇮🇳</div>
                <div className="persona-card-head">
                  <h3>Indian Citizen</h3>
                  <span className="persona-tag-pill green">Domestic Traveler</span>
                </div>
                <p className="persona-card-desc">
                  Explore India’s sacred heritage, state transit passes (KSRTC, DMRC, Mumbai Chalo, Kadamba), and guaranteed fair benchmark rates in Indian Rupees (₹).
                </p>
                <ul className="persona-benefits-list">
                  <li><CheckCircle2 size={13} color="var(--success)" /> Instant direct access — zero visa or passport gates</li>
                  <li><CheckCircle2 size={13} color="var(--success)" /> Local commuter transit passes with exact Indian fare cards</li>
                  <li><CheckCircle2 size={13} color="var(--success)" /> Certified digital travel protection agreements</li>
                </ul>
                <button className="btn-persona-action primary">
                  <span>Continue as Indian Citizen</span>
                  <ArrowRight size={15} />
                </button>
              </div>

              {/* Option B: Foreign Tourist */}
              <div
                className={`persona-option-card foreign ${currentType === "foreign" ? "selected" : ""}`}
                onClick={() => setStep("foreign_details")}
              >
                <div className="persona-card-flag">🌐</div>
                <div className="persona-card-head">
                  <h3>Foreign Traveler</h3>
                  <span className="persona-tag-pill yellow">International Tourist</span>
                </div>
                <p className="persona-card-desc">
                  Official Government of India Visa guidelines, mandatory white-background photo standards, currency exchange rates, and 24x7 Multi-Lingual Tourist Helpline.
                </p>
                <ul className="persona-benefits-list">
                  <li><CheckCircle2 size={13} color="var(--yellow)" /> Real-time Indian e-Visa & Visa on Arrival verification</li>
                  <li><CheckCircle2 size={13} color="var(--yellow)" /> Mandatory photo specifications (White background, 350x350)</li>
                  <li><CheckCircle2 size={13} color="var(--yellow)" /> Direct access to official Gov portal (indianvisaonline.gov.in)</li>
                </ul>
                <button className="btn-persona-action secondary">
                  <span>Verify Visa & Requirements</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Foreign Traveler Country Selection & Mandatory Documents ── */}
        {step === "foreign_details" && (
          <div className="persona-step-wrap">
            <div className="persona-header-nav">
              <button className="persona-back-btn" onClick={() => setStep("persona")}>
                <ArrowLeft size={16} />
                <span>Back to Traveler Selection</span>
              </button>
              <div className="persona-gov-tag">
                <ShieldCheck size={13} color="var(--yellow)" />
                <span>Ministry of Tourism & Bureau of Immigration Compliant</span>
              </div>
            </div>

            <div className="foreign-flow-grid">
              {/* Left Column: Country Selector */}
              <div className="country-selector-col">
                <div className="field-label" style={{ marginBottom: 8, color: "#FFF" }}>
                  Select Your Country of Citizenship / Passport:
                </div>

                <div className="country-search-bar">
                  <Search size={15} color="var(--gray)" />
                  <input
                    type="text"
                    placeholder="Search your country (e.g. USA, UK, Germany...)"
                    value={searchCountry}
                    onChange={e => setSearchCountry(e.target.value)}
                  />
                  {searchCountry && (
                    <button onClick={() => setSearchCountry("")} style={{ background: "none", border: "none", color: "var(--gray)", cursor: "pointer" }}>
                      ✕
                    </button>
                  )}
                </div>

                <div className="country-chips-scroll">
                  {filteredCountries.map(c => {
                    const isSelected = selectedCountryName.toLowerCase() === c.country.toLowerCase();
                    return (
                      <button
                        key={c.code}
                        className={`country-pill ${isSelected ? "active" : ""}`}
                        onClick={() => setSelectedCountryName(c.country)}
                      >
                        <span style={{ fontSize: 18 }}>{c.flag}</span>
                        <span className="country-pill-name">{c.country}</span>
                        {isSelected && <CheckCircle2 size={14} color="#0C0E12" />}
                      </button>
                    );
                  })}
                </div>

                {/* Country Visa Category Banner */}
                <div className="country-visa-banner">
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 28 }}>{activeVisaRule.flag}</span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#FFF" }}>{activeVisaRule.country}</div>
                      <div style={{ fontSize: 11, color: "var(--yellow)", fontWeight: 700 }}>{activeVisaRule.categoryLabel}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--gray-light)", lineHeight: 1.5, marginBottom: 12 }}>
                    {activeVisaRule.notes}
                  </p>
                  <div className="visa-metric-row">
                    <div>
                      <span className="visa-metric-lbl">Validity</span>
                      <span className="visa-metric-val">{activeVisaRule.validitySummary}</span>
                    </div>
                    <div>
                      <span className="visa-metric-lbl">Official Fee</span>
                      <span className="visa-metric-val" style={{ color: "var(--yellow)" }}>{activeVisaRule.feesSummary}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Required Documents & Official Gov Navigation */}
              <div className="documents-checklist-col">
                <div className="checklist-header">
                  <FileText size={18} color="var(--yellow)" />
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#FFF", margin: 0 }}>
                      Mandatory Entry Documents for {activeVisaRule.country}
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--gray-light)", margin: "2px 0 0 0" }}>
                      Strict Bureau of Immigration entry requirements for entering India.
                    </p>
                  </div>
                </div>

                {/* Photo Alert Banner */}
                <div className="photo-spec-box">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--yellow)", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                    <Camera size={16} />
                    <span>Strict Digital Photo Specification (Pure White Background)</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#DDD", lineHeight: 1.45, margin: 0 }}>
                    The Indian visa system strictly requires a <strong>pure white background</strong> (cream, off-white or colored backgrounds are automatically rejected). Format: JPEG (10 KB to 1 MB, minimum 350x350 pixels). Full face front view, open eyes, no reflection on glasses.
                  </p>
                </div>

                {/* Documents List */}
                <div className="docs-scroll-list">
                  {MANDATORY_FOREIGN_DOCUMENTS.map(doc => (
                    <div key={doc.id} className="doc-item-card">
                      <div className="doc-item-head">
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {doc.id === "passport" && <FileText size={14} color="var(--yellow)" />}
                          {doc.id === "photo" && <Camera size={14} color="var(--yellow)" />}
                          {doc.id === "passport_bio" && <FileText size={14} color="var(--yellow)" />}
                          {doc.id === "tickets" && <Plane size={14} color="var(--yellow)" />}
                          {doc.id === "funds" && <CreditCard size={14} color="var(--yellow)" />}
                          {doc.id === "health" && <ShieldCheck size={14} color="var(--yellow)" />}
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#FFF" }}>{doc.title}</span>
                        </div>
                        <span className="doc-badge-pill">{doc.badge}</span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--gray-light)", lineHeight: 1.4, margin: "6px 0 0 0" }}>
                        {doc.desc}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Official Gov Site Navigation Button */}
                <div className="gov-nav-section">
                  <div className="fraud-warning-note">
                    <AlertTriangle size={13} color="var(--yellow)" />
                    <span>Only use the genuine Government portal <code>indianvisaonline.gov.in</code>. Beware of clone scam websites!</span>
                  </div>

                  <a
                    href={OFFICIAL_GOV_VISA_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-official-gov"
                    onClick={() => {
                      onConfirmForeign(activeVisaRule.country, activeVisaRule);
                    }}
                  >
                    <ExternalLink size={16} />
                    <span>Apply / Verify on Official Gov Portal (indianvisaonline.gov.in) ↗</span>
                  </a>

                  <button
                    className="btn-proceed-traveler"
                    onClick={() => {
                      onConfirmForeign(activeVisaRule.country, activeVisaRule);
                    }}
                  >
                    <span>I Have My Documents / Explore Indian Destinations</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
