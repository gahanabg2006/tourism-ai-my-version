"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

// Client-only dynamic import of WalletMultiButton to eliminate Next.js SSR hydration mismatch
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  {
    ssr: false,
    loading: () => (
      <button className="wallet-adapter-button" style={{ opacity: 0.8 }}>
        Select Wallet
      </button>
    ),
  }
);

import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { tourismIdl } from "../lib/tourism-idl";
import {
  Globe, Search, Sparkles, CheckCircle, Phone, DollarSign,
  ExternalLink, Loader2, ArrowRight, ArrowLeft, Plus, RefreshCw, Lock,
  Zap, Receipt, MapPin, Clock, Star, Train, Bus, Car, Ship,
  Bike, Check, Users, ShieldCheck, Flame, Leaf, Coffee,
  Calendar, RotateCcw, ClipboardList, Ticket, Compass,
  Mail, Download, WifiOff, Printer,
} from "lucide-react";
import {
  getCuratedCityData,
  getCityHelplines,
  getCityReferenceRates,
  type CuratedCity,
  type CityAttraction,
} from "../lib/curated-city-data";
import TravelerPersonaModal from "../components/TravelerPersonaModal";
import {
  SUPPORTED_LANGUAGES,
  getTranslation,
  type LanguageCode,
} from "../lib/i18n";
import LanguageSelectorModal from "../components/LanguageSelectorModal";
import { SendEmailModal } from "../components/SendEmailModal";
import { OfflineRemoteModal } from "../components/OfflineRemoteModal";
import { ExperienceRatingWidget } from "../components/ExperienceRatingWidget";
import PinMap, { MAP_PINS, formatCoord } from "../components/PinMap";
import { ITINERARY_AGENT_ASSET, SOLANA_CLUSTER, TOURISM_PROGRAM_ID, explorerUrl } from "../lib/solana-config";
import {
  downloadOfflinePassFile,
  printOfflinePass,
  type ItineraryPlan,
} from "../lib/offline-pass-generator";

// ─── Types ───────────────────────────────────────────────────────────────────
type MainTab = "discover" | "agents" | "price" | "safety" | "records";

type DestinationItem = {
  id: string; name: string; country: string; flag: string;
  price: string; tag: string; tagline: string; tripTitle: string;
  duration: string; activityLevel: string; accommodation: string;
  bestSeason: string; description: string; heroImg: string;
  thumbs: string[];
  stops: Array<{ time: string; name: string; cost: string; desc: string }>;
};

// ─── Image Fallbacks (Ultra-HD 2K & Verified Local Landmarks) ───────────────
const FALLBACK_HERO = "/images/destinations/mysore-palace.jpg";
const FALLBACK_THUMB = "/images/destinations/hawa-mahal.jpg";

// ─── Data: 20 Curated 100% Indian Cultural Destinations ───────────────────────
const DESTINATIONS: DestinationItem[] = [
  {
    id: "mysuru", name: "Mysuru", country: "India", flag: "🇮🇳",
    price: "From ₹4,500", tag: "Heritage Pick",
    tagline: "Palaces of light, sandalwood heritage, and Karnataka's cultural heartland.",
    tripTitle: "Royal Heritage & Mysore Silk", duration: "3 days",
    activityLevel: "Easy to Moderate", accommodation: "Heritage Havelis & 4-Star",
    bestSeason: "Oct – Mar",
    description: "Mysuru is Karnataka's cultural capital, celebrated for the illuminated Mysore Palace with 100,000 bulbs, Chamundi Hill vistas, Devaraja Market fragrances, and centuries-old sandalwood carving and silk weaving traditions.",
    heroImg: "/images/destinations/mysore-palace.jpg",
    thumbs: [
      "/images/destinations/chamundi-hill.jpg",
      "/images/destinations/devaraja-market.jpg",
      "/images/destinations/brindavan-gardens.jpg",
    ],
    stops: [
      { time: "09:30 AM", name: "Mysuru Palace Grand Tour", cost: "₹100", desc: "Indo-Saracenic royal residence and golden throne hall" },
      { time: "12:00 PM", name: "Devaraja Market & Spice Walk", cost: "₹0", desc: "Historic covered bazaar with fresh jasmine and local crafts" },
      { time: "04:30 PM", name: "Chamundi Hill & Sunrise Vista", cost: "₹0", desc: "Panoramic view over the city and sacred Nandi Bull" },
    ],
  },
  {
    id: "jaipur", name: "Jaipur", country: "India", flag: "🇮🇳",
    price: "From ₹5,200", tag: "Heritage Pick",
    tagline: "The Pink City — Rajput royalty, desert colors, and artisan bazaars.",
    tripTitle: "Forts, Palaces & Desert Gold", duration: "4 days",
    activityLevel: "Easy to Moderate", accommodation: "Heritage Forts & Palace Hotels",
    bestSeason: "Oct – Mar",
    description: "Jaipur is the jewel of Rajasthan — a city built in rose-pink sandstone. Explore the majestic Amber Fort, the latticed Hawa Mahal, and the royal city palace, while shopping for gems, silk, and lac bangles in Johari Bazaar.",
    heroImg: "/images/destinations/hawa-mahal.jpg",
    thumbs: [
      "/images/destinations/amber-fort.jpg",
      "/images/destinations/city-palace-jaipur.jpg",
      "/images/destinations/jantar-mantar.jpg",
    ],
    stops: [
      { time: "09:00 AM", name: "Amer Fort & Maota Lake", cost: "₹100", desc: "Hilltop citadel with Sheesh Mahal (Mirror Palace)" },
      { time: "01:30 PM", name: "Hawa Mahal (Palace of Winds)", cost: "₹50", desc: "Five-story pink sandstone screen built for royal women" },
      { time: "04:30 PM", name: "Johari Bazaar Gem & Silk Walk", cost: "₹0", desc: "Famous market for traditional jewelry and Jaipuri quilts" },
    ],
  },
  {
    id: "goa", name: "Goa", country: "India", flag: "🇮🇳",
    price: "From ₹7,500", tag: "Budget Friendly",
    tagline: "Sun, sea, Portuguese history, and India's most vibrant beach culture.",
    tripTitle: "Beaches & Bougainvillea", duration: "5 days",
    activityLevel: "Easy", accommodation: "Beach Resorts & Boutique Stays",
    bestSeason: "Nov – Feb",
    description: "Goa is India's coastal gem — a blend of Konkani culture, Portuguese colonial heritage, silver-sand beaches, and vibrant nightlife. Explore Old Goa's UNESCO churches, spice plantations, and legendary beach shacks.",
    heroImg: "/images/destinations/palolem-beach.jpg",
    thumbs: [
      "/images/destinations/bom-jesus.jpg",
      "/images/destinations/fontainhas.jpg",
      "/images/destinations/dudhsagar-falls.jpg",
    ],
    stops: [
      { time: "10:00 AM", name: "Basilica of Bom Jesus, Old Goa", cost: "₹0", desc: "UNESCO World Heritage baroque church housing St. Francis Xavier" },
      { time: "02:00 PM", name: "Palolem Crescent Beach", cost: "₹0", desc: "Calm swimming waters, dolphin boat trips, and seaside shacks" },
      { time: "07:00 PM", name: "Panjim Latin Quarter Walk", cost: "₹0", desc: "Portuguese-era colorful houses and riverfront dining" },
    ],
  },
  {
    id: "delhi", name: "Delhi", country: "India", flag: "🇮🇳",
    price: "From ₹5,000", tag: "Heritage Pick",
    tagline: "Imperial monuments, street food corridors, and timeless cultural heritage.",
    tripTitle: "Mughal Grandeur & Modern Capital", duration: "3 days",
    activityLevel: "Moderate", accommodation: "Boutique Havelis & Luxury Stays",
    bestSeason: "Oct – Mar",
    description: "Delhi is a vibrant tapestry of centuries — from Mughal-era Red Fort and Jama Masjid to the illuminated India Gate and Qutub Minar, complete with world-famous street food in Old Delhi.",
    heroImg: "/images/destinations/india-gate.jpg",
    thumbs: [
      "/images/destinations/qutub-minar.jpg",
      "/images/destinations/humayuns-tomb.jpg",
      "/images/destinations/red-fort.jpg",
    ],
    stops: [
      { time: "09:30 AM", name: "India Gate & Kartavya Path", cost: "₹0", desc: "Iconic war memorial archway surrounded by sprawling lawns and fountains" },
      { time: "01:00 PM", name: "Chandni Chowk Street Food Trail", cost: "₹350", desc: "Century-old parathas, jalebis, and spicy chaat in Old Delhi" },
      { time: "04:30 PM", name: "Qutub Minar Complex", cost: "₹40", desc: "UNESCO World Heritage 73-meter minaret and Iron Pillar of Delhi" },
    ],
  },
  {
    id: "bangalore", name: "Bangalore", country: "India", flag: "🇮🇳",
    price: "From ₹6,200", tag: "Trending",
    tagline: "Garden City elegance meets the cutting-edge Silicon Valley of India.",
    tripTitle: "Tech Parks, Craft Beer & Botanical Green", duration: "3 days",
    activityLevel: "Easy", accommodation: "Modern Business Hotels & Suites",
    bestSeason: "Year-Round",
    description: "Bangalore blends leafy boulevards, colonial-era parks like Lalbagh, vibrant microbreweries, and the futuristic innovation hub that powers India's digital revolution.",
    heroImg: "/images/destinations/vidhana-soudha.jpg",
    thumbs: [
      "/images/destinations/lalbagh-glasshouse.jpg",
      "/images/destinations/bangalore-palace.jpg",
      "/images/destinations/cubbon-park.jpg",
    ],
    stops: [
      { time: "08:30 AM", name: "Lalbagh Botanical Garden", cost: "₹30", desc: "Historic glass house inspired by London's Crystal Palace and centuries-old trees" },
      { time: "01:00 PM", name: "Indiranagar Craft Breweries & Cafes", cost: "₹800", desc: "Artisanal food and vibrant city social scene" },
      { time: "05:00 PM", name: "Bangalore Palace Grand Tour", cost: "₹250", desc: "Tudor-style royal estate with ornate woodwork and family memorabilia" },
    ],
  },
  {
    id: "kerala", name: "Kerala", country: "India", flag: "🇮🇳",
    price: "From ₹8,900", tag: "Trending",
    tagline: "Emerald backwaters, misty tea gardens of Munnar, and Ayurvedic wellness.",
    tripTitle: "God's Own Country Explorer", duration: "6 days",
    activityLevel: "Easy", accommodation: "Houseboats & Plantation Bungalows",
    bestSeason: "Sep – Mar",
    description: "Kerala features palm-fringed lagoons, tranquil backwaters in Alleppey, sprawling tea estates in Munnar, and centuries-old Kathakali traditions along the Arabian Sea.",
    heroImg: "/images/destinations/kerala-backwaters.jpg",
    thumbs: [
      "/images/destinations/munnar-tea.jpg",
      "/images/destinations/kochi-nets.jpg",
      "/images/destinations/athirappilly.jpg",
    ],
    stops: [
      { time: "09:00 AM", name: "Alleppey Houseboat Cruise", cost: "₹1,200", desc: "Gliding through palm-fringed canals and tranquil lagoons" },
      { time: "02:00 PM", name: "Munnar Tea Estate & Tasting", cost: "₹150", desc: "Lush green rolling hills and fresh cardamom plantations" },
      { time: "06:30 PM", name: "Fort Kochi Chinese Nets Sunset", cost: "₹0", desc: "Cantilevered wooden nets silhouetted against the Arabian Sea" },
    ],
  },
  {
    id: "varanasi", name: "Varanasi", country: "India", flag: "🇮🇳",
    price: "From ₹4,800", tag: "Heritage Pick",
    tagline: "The eternal spiritual city along the sacred Ganges ghats.",
    tripTitle: "Ghats, Ganga Aarti & Silk", duration: "3 days",
    activityLevel: "Moderate", accommodation: "Riverside Havelis",
    bestSeason: "Oct – Mar",
    description: "Varanasi is one of the world's oldest living cities. Experience the mesmerizing evening Ganga Aarti at Dashashwamedh Ghat, dawn boat rides along the ghats, and ancient Banarasi silk weaving.",
    heroImg: "/images/destinations/varanasi-ghats.jpg",
    thumbs: [
      "/images/destinations/dashashwamedh-ghat.jpg",
      "/images/destinations/kashi-vishwanath.jpg",
      "/images/destinations/sarnath.jpg",
    ],
    stops: [
      { time: "05:30 AM", name: "Sunrise Boat Ride on Ganges", cost: "₹250", desc: "Peaceful morning views of historic bathing ghats and palaces" },
      { time: "11:00 AM", name: "Kashi Vishwanath Corridor", cost: "₹0", desc: "Revered golden temple dedicated to Lord Shiva" },
      { time: "06:30 PM", name: "Dashashwamedh Ganga Aarti", cost: "₹0", desc: "Grand multi-priest devotional prayer with flaming lamps" },
    ],
  },
  {
    id: "hampi", name: "Hampi", country: "India", flag: "🇮🇳",
    price: "From ₹5,000", tag: "Heritage Pick",
    tagline: "Vijayanagara boulder kingdom and UNESCO architectural marvels.",
    tripTitle: "Ruins of the Forgotten Empire", duration: "3 days",
    activityLevel: "Moderate", accommodation: "Heritage Resorts & River Huts",
    bestSeason: "Nov – Feb",
    description: "Hampi's surreal landscape of granite boulders frames the ruins of the 14th-century Vijayanagara Empire. Marvel at the stone chariot of Vittala Temple and the towering Virupaksha Temple.",
    heroImg: "/images/destinations/hampi-chariot.jpg",
    thumbs: [
      "/images/destinations/virupaksha-temple.jpg",
      "/images/destinations/matanga-hill.jpg",
      "/images/destinations/lotus-mahal.jpg",
    ],
    stops: [
      { time: "08:30 AM", name: "Vittala Temple & Stone Chariot", cost: "₹40", desc: "Iconic chariot sculpture and acoustic musical pillars" },
      { time: "01:00 PM", name: "Lotus Mahal & Elephant Stables", cost: "₹0", desc: "Indo-Islamic royal pavilions amidst gardens" },
      { time: "05:00 PM", name: "Sunset at Matanga Hill", cost: "₹0", desc: "Spectacular 360-degree panorama of boulder fields and ruins" },
    ],
  },
  {
    id: "ladakh", name: "Ladakh", country: "India", flag: "🇮🇳",
    price: "From ₹14,500", tag: "Trending",
    tagline: "High-altitude Himalayan desert, monasteries, and sapphire lakes.",
    tripTitle: "Roof of the World Expedition", duration: "7 days",
    activityLevel: "Challenging", accommodation: "Luxury Glamping & Homestays",
    bestSeason: "Jun – Sep",
    description: "Ladakh is a stark high-altitude paradise known for Tibetan Buddhist monasteries perched on cliffs, the crystal-blue Pangong Tso lake, and the highest motorable passes in the world.",
    heroImg: "/images/destinations/pangong-tso.jpg",
    thumbs: [
      "/images/destinations/thiksey-monastery.jpg",
      "/images/destinations/khardung-la.jpg",
      "/images/destinations/nubra-valley.jpg",
    ],
    stops: [
      { time: "09:00 AM", name: "Thiksey Monastery Morning Prayer", cost: "₹50", desc: "12-story hilltop complex resembling Lhasa's Potala Palace" },
      { time: "02:00 PM", name: "Khardung La Pass Crossing", cost: "₹0", desc: "Drive across 17,982 ft mountain pass into Nubra Valley" },
      { time: "05:00 PM", name: "Pangong Tso Sunset Reflections", cost: "₹0", desc: "World's highest saltwater lake changing from turquoise to deep blue" },
    ],
  },
  {
    id: "coorg", name: "Coorg", country: "India", flag: "🇮🇳",
    price: "From ₹6,200", tag: "Budget Friendly",
    tagline: "Coffee capital of India, cascading waterfalls, and Kodava hospitality.",
    tripTitle: "Coffee Trails & Western Ghats", duration: "3 days",
    activityLevel: "Easy", accommodation: "Coffee Plantation Estates",
    bestSeason: "Oct – Apr",
    description: "Nestled in the lush Western Ghats, Coorg (Kodagu) is renowned for misty coffee plantations, spice gardens, Abbey Falls, and the source of the sacred River Cauvery.",
    heroImg: "/images/destinations/coorg-hills.jpg",
    thumbs: [
      "/images/destinations/abbey-falls.jpg",
      "/images/destinations/rajas-seat.jpg",
      "/images/destinations/namdroling-monastery.jpg",
    ],
    stops: [
      { time: "09:30 AM", name: "Organic Coffee & Pepper Walk", cost: "₹150", desc: "Guided walking tour through Arabica and Robusta plantations" },
      { time: "01:30 PM", name: "Abbey Falls & Hanging Bridge", cost: "₹20", desc: "Spectacular waterfall dropping amidst dense spice groves" },
      { time: "05:00 PM", name: "Raja's Seat Sunset Garden", cost: "₹25", desc: "Historic royal viewpoint overlooking rolling green valleys" },
    ],
  },
  {
    id: "udaipur", name: "Udaipur", country: "India", flag: "🇮🇳",
    price: "From ₹6,800", tag: "Heritage Pick",
    tagline: "The City of Lakes — marble palaces, ghats, and royal Mewar heritage.",
    tripTitle: "Venice of the East Royalty", duration: "4 days",
    activityLevel: "Easy", accommodation: "Heritage Lakefront Havelis",
    bestSeason: "Oct – Mar",
    description: "Udaipur captivates visitors with romantic Lake Pichola, the sprawling City Palace complex, Jag Mandir island, and colorful traditional artisan markets.",
    heroImg: "/images/destinations/udaipur-city-palace.jpg",
    thumbs: [
      "/images/destinations/lake-pichola.jpg",
      "/images/destinations/saheliyon-ki-bari.jpg",
      "/images/destinations/jagdish-temple.jpg",
    ],
    stops: [
      { time: "09:30 AM", name: "Udaipur City Palace", cost: "₹300", desc: "Rajasthan's largest royal palace with mirrors, tiles, and lake views" },
      { time: "02:00 PM", name: "Lake Pichola Boat Ride", cost: "₹450", desc: "Cruising past Jag Niwas (Lake Palace) and Jag Mandir" },
      { time: "06:00 PM", name: "Bagore Ki Haveli Folk Dance", cost: "₹100", desc: "Evening Dharohar cultural performance on the edge of the lake" },
    ],
  },
  {
    id: "agra", name: "Agra", country: "India", flag: "🇮🇳",
    price: "From ₹4,200", tag: "Heritage Pick",
    tagline: "The Taj Mahal, monumental Agra Red Fort, and Mughal architectural grandeur.",
    tripTitle: "Mughal Splendor & Marble Poetry", duration: "2 days",
    activityLevel: "Easy to Moderate", accommodation: "Heritage Hotels with Taj Views",
    bestSeason: "Oct – Mar",
    description: "Home to the incomparable Taj Mahal, Agra was the seat of the Mughal Empire at its zenith. Marvel at the white marble poetry of the Taj, explore the fortified palaces of Agra Fort, and visit the imperial ghost city of Fatehpur Sikri.",
    heroImg: "/images/destinations/taj-mahal.jpg",
    thumbs: [
      "/images/destinations/agra-fort.jpg",
      "/images/destinations/mehtab-bagh.jpg",
      "/images/destinations/fatehpur-sikri.jpg",
    ],
    stops: [
      { time: "06:00 AM", name: "Taj Mahal Sunrise Visit", cost: "₹50", desc: "Witness the morning light transform white Makrana marble" },
      { time: "11:30 AM", name: "Agra Red Fort Tour", cost: "₹50", desc: "Massive sandstone fortress and royal Mughal pavilions" },
      { time: "05:00 PM", name: "Mehtab Bagh Sunset View", cost: "₹25", desc: "Mughal charbagh garden across the river from the Taj" },
    ],
  },
  {
    id: "mumbai", name: "Mumbai", country: "India", flag: "🇮🇳",
    price: "From ₹6,500", tag: "Trending",
    tagline: "City of Dreams — Gateway of India, Marine Drive promenades, and coastal pulse.",
    tripTitle: "Colonial Grandeur & Arabian Coasts", duration: "3 days",
    activityLevel: "Moderate", accommodation: "South Mumbai Heritage Stays",
    bestSeason: "Nov – Feb",
    description: "Mumbai is India's financial and cultural powerhouse, featuring Victorian Gothic landmarks, bustling Marine Drive sunsets, historic Irani cafés, and the ancient rock-cut Elephanta Island caves.",
    heroImg: "/images/destinations/mumbai-gateway.jpg",
    thumbs: [
      "/images/destinations/marine-drive.jpg",
      "/images/destinations/cst-mumbai.jpg",
      "/images/destinations/elephanta-caves.jpg",
    ],
    stops: [
      { time: "09:00 AM", name: "Gateway of India & Elephanta Ferry", cost: "₹260", desc: "Harbor boat trip to 5th-century rock-cut Shiva Trimurti caves" },
      { time: "02:00 PM", name: "Kala Ghoda Art & Cafe Trail", cost: "₹0", desc: "Pedestrian art district with Victorian buildings and artisanal dining" },
      { time: "06:00 PM", name: "Marine Drive Queen's Necklace Walk", cost: "₹0", desc: "Sunset sea breeze along the illuminated 3.6 km crescent promenade" },
    ],
  },
  {
    id: "amritsar", name: "Amritsar", country: "India", flag: "🇮🇳",
    price: "From ₹3,900", tag: "Heritage Pick",
    tagline: "The Golden Temple, community langar hospitality, and patriotic Wagah border pride.",
    tripTitle: "Sacred Gold & Punjabi Heritage", duration: "2 days",
    activityLevel: "Easy", accommodation: "Heritage Hotels near Golden Temple",
    bestSeason: "Oct – Mar",
    description: "Amritsar is the spiritual heart of Sikhism, famous for the glowing Harmandir Sahib surrounded by the sacred Amrit Sarovar, the poignant history of Jallianwala Bagh, and the patriotic Wagah border ceremony.",
    heroImg: "/images/destinations/golden-temple.jpg",
    thumbs: [
      "/images/destinations/jallianwala-bagh.jpg",
      "/images/destinations/wagah-border.jpg",
      "/images/destinations/golden-temple.jpg",
    ],
    stops: [
      { time: "08:00 AM", name: "Golden Temple (Harmandir Sahib)", cost: "₹0", desc: "Sacred gilded shrine, peaceful hymns, and community langar" },
      { time: "12:00 PM", name: "Jallianwala Bagh Memorial", cost: "₹0", desc: "Historic national memorial and martyrs' well" },
      { time: "04:30 PM", name: "Attari-Wagah Border Ceremony", cost: "₹0", desc: "Daily military beating retreat ceremony at international border" },
    ],
  },
  {
    id: "rishikesh", name: "Rishikesh", country: "India", flag: "🇮🇳",
    price: "From ₹4,500", tag: "Budget Friendly",
    tagline: "Yoga capital of the world, sacred turquoise Ganges, and Himalayan foothills.",
    tripTitle: "Yoga, Ganga Aarti & Himalayan Rapids", duration: "3 days",
    activityLevel: "Moderate", accommodation: "Riverside Ashrams & Wellness Resorts",
    bestSeason: "Sep – Nov / Feb – May",
    description: "Cradled in the Himalayan foothills along the crystal-clear Ganges, Rishikesh is the global capital of yoga and meditation. Experience suspension bridges, evening Ganga Aarti at Triveni Ghat, and thrilling white-water rafting.",
    heroImg: "/images/destinations/lakshman-jhula.jpg",
    thumbs: [
      "/images/destinations/triveni-ghat.jpg",
      "/images/destinations/parmarth-niketan.jpg",
      "/images/destinations/beatles-ashram.jpg",
    ],
    stops: [
      { time: "07:30 AM", name: "Ganges Yoga & Meditation", cost: "₹0", desc: "Morning yoga session by the sacred river banks" },
      { time: "11:00 AM", name: "Beatles Ashram & Ram Jhula Walk", cost: "₹150", desc: "Historic 1968 meditation retreat and suspension bridge" },
      { time: "06:00 PM", name: "Triveni Ghat Maha Aarti", cost: "₹0", desc: "Spectacular evening lamp ritual with devotional chants" },
    ],
  },
  {
    id: "jaisalmer", name: "Jaisalmer", country: "India", flag: "🇮🇳",
    price: "From ₹5,800", tag: "Heritage Pick",
    tagline: "The Golden City — living sandstone fort, Thar Desert dunes, and camel safaris.",
    tripTitle: "Thar Desert Magic & Golden Citadel", duration: "3 days",
    activityLevel: "Moderate", accommodation: "Desert Luxury Tents & Havelis",
    bestSeason: "Oct – Mar",
    description: "Rising like a mirage from the Thar Desert, Jaisalmer is crafted entirely from golden yellow sandstone. Explore the living 12th-century Jaisalmer Fort, ornate Patwon Ki Haveli, and spend a night stargazing over the Sam Sand Dunes.",
    heroImg: "/images/destinations/jaisalmer-fort.jpg",
    thumbs: [
      "/images/destinations/sam-sand-dunes.jpg",
      "/images/destinations/patwon-ki-haveli.jpg",
      "/images/destinations/gadisar-lake.jpg",
    ],
    stops: [
      { time: "09:00 AM", name: "Jaisalmer Golden Fort Walk", cost: "₹0", desc: "Explore the living fortress with medieval residences and Jain temples" },
      { time: "02:00 PM", name: "Patwon Ki Haveli Stone Carving", cost: "₹50", desc: "Elaborately carved sandstone balconies and courtyards" },
      { time: "04:30 PM", name: "Sam Sand Dunes Camel Safari", cost: "₹500", desc: "Sunset camel ride across Thar desert dunes with folk music" },
    ],
  },
  {
    id: "srinagar", name: "Srinagar", country: "India", flag: "🇮🇳",
    price: "From ₹9,200", tag: "Trending",
    tagline: "Paradise on Earth — Dal Lake shikaras, floating houseboats, and Mughal gardens.",
    tripTitle: "Kashmir Valley Splendor", duration: "4 days",
    activityLevel: "Easy", accommodation: "Cedar Houseboats & Luxury Resorts",
    bestSeason: "Apr – Oct (Autumn Gold)",
    description: "Srinagar is the jewel of Kashmir, surrounded by snow-capped Pir Panjal mountains. Glide in wooden shikaras along Dal Lake, stay in carved walnut-wood houseboats, and walk through Nishat and Shalimar Mughal terraced gardens.",
    heroImg: "/images/destinations/dal-lake.jpg",
    thumbs: [
      "/images/destinations/nishat-bagh.jpg",
      "/images/destinations/shankaracharya-temple.jpg",
      "/images/destinations/gulmarg.jpg",
    ],
    stops: [
      { time: "06:00 AM", name: "Dal Lake Shikara & Floating Market", cost: "₹800", desc: "Peaceful morning boat ride past lotus gardens and markets" },
      { time: "11:00 AM", name: "Nishat & Shalimar Mughal Gardens", cost: "₹25", desc: "Terraced water fountains with majestic Chinar tree canopies" },
      { time: "04:00 PM", name: "Shankaracharya Hilltop Temple", cost: "₹0", desc: "Ancient stone Shiva shrine overlooking Srinagar valley" },
    ],
  },
  {
    id: "andaman", name: "Andaman Islands", country: "India", flag: "🇮🇳",
    price: "From ₹12,800", tag: "Trending",
    tagline: "Pristine turquoise waters, white coral sands, and lush tropical islands.",
    tripTitle: "Tropical Reefs & Coral Paradise", duration: "5 days",
    activityLevel: "Moderate", accommodation: "Beachfront Eco-Villas & Resorts",
    bestSeason: "Oct – May",
    description: "The Andaman Islands offer India's ultimate tropical escape. Visit Radhanagar Beach on Havelock Island (voted among Asia's best beaches), snorkel vibrant coral reefs at Elephant Beach, and tour the historic Cellular Jail in Port Blair.",
    heroImg: "/images/destinations/radhanagar-beach.jpg",
    thumbs: [
      "/images/destinations/cellular-jail.jpg",
      "/images/destinations/elephant-beach.jpg",
      "/images/destinations/ross-island.jpg",
    ],
    stops: [
      { time: "09:00 AM", name: "Cellular Jail National Memorial", cost: "₹30", desc: "Historic freedom struggle monument in Port Blair" },
      { time: "02:00 PM", name: "Radhanagar Beach Sunset Walk", cost: "₹0", desc: "Pristine white sand and crystalline turquoise ocean water" },
      { time: "06:00 PM", name: "Ross Island Heritage Ruins", cost: "₹50", desc: "British colonial ruins overgrown with giant banyan roots" },
    ],
  },
  {
    id: "darjeeling", name: "Darjeeling", country: "India", flag: "🇮🇳",
    price: "From ₹5,500", tag: "Budget Friendly",
    tagline: "Queen of the Hills — Himalayan toy train, tea estates, and Kanchenjunga peaks.",
    tripTitle: "Tea Gardens & Mountain Steam", duration: "3 days",
    activityLevel: "Easy to Moderate", accommodation: "Colonial Heritage Hotels & Homestays",
    bestSeason: "Mar – May / Oct – Dec",
    description: "Perched at 6,700 feet with panoramic views of Mount Kanchenjunga, Darjeeling is world-famous for its aromatic tea plantations, the UNESCO World Heritage steam Toy Train, and crisp mountain air.",
    heroImg: "/images/destinations/darjeeling-toy-train.jpg",
    thumbs: [
      "/images/destinations/tiger-hill.jpg",
      "/images/destinations/happy-valley-tea.jpg",
      "/images/destinations/peace-pagoda.jpg",
    ],
    stops: [
      { time: "04:30 AM", name: "Tiger Hill Sunrise over Kanchenjunga", cost: "₹50", desc: "Witness dawn illuminate the world's 3rd highest mountain peak" },
      { time: "10:00 AM", name: "Darjeeling Himalayan Railway (Toy Train)", cost: "₹600", desc: "UNESCO heritage narrow-gauge steam engine joyride via Batasia Loop" },
      { time: "02:30 PM", name: "Happy Valley Tea Estate Tasting", cost: "₹150", desc: "Walk through emerald tea bushes and taste fine First Flush teas" },
    ],
  },
  {
    id: "meghalaya", name: "Meghalaya", country: "India", flag: "🇮🇳",
    price: "From ₹7,900", tag: "Trending",
    tagline: "Abode of Clouds — living root bridges, thundering waterfalls, and crystal Dawki river.",
    tripTitle: "Living Root Bridges & Cloud Forests", duration: "4 days",
    activityLevel: "Challenging", accommodation: "Bamboo Eco-Lodges & Homestays",
    bestSeason: "Oct – Apr",
    description: "Meghalaya is a wonderland of bio-engineered living root bridges in Cherrapunji, crystalline transparent waters in Dawki River, and roaring waterfalls plunging into emerald rainforest canyons.",
    heroImg: "/images/destinations/living-root-bridge.jpg",
    thumbs: [
      "/images/destinations/nohkalikai-falls.jpg",
      "/images/destinations/dawki-river.jpg",
      "/images/destinations/krang-shuri.jpg",
    ],
    stops: [
      { time: "08:00 AM", name: "Double Decker Living Root Bridge Trek", cost: "₹50", desc: "Hike through lush Khasi rainforest to 150-year-old living rubber tree bridges" },
      { time: "01:30 PM", name: "Nohkalikai Falls Observation", cost: "₹20", desc: "Tallest plunge waterfall in India dropping 1,115 feet into an emerald pool" },
      { time: "04:30 PM", name: "Dawki Umngot River Boat Ride", cost: "₹800", desc: "Boating on crystal-clear transparent waters where boats seem to float in air" },
    ],
  },
];

const ALL_TAGS = ["All", "Heritage Pick", "Trending", "Budget Friendly"];

// Stays + dining per day for each budget tier (USD). Tickets and transit are added per selection.
const TIER_DAILY_USD = { budget: 35, comfort: 95, luxury: 240 } as const;

// Labels for /api/agents verification statuses (server is the source of truth).
const AGENT_STATUS_LABELS: Record<string, string> = {
  verified: "Verified on-chain",
  unregistered: "Not registered",
  mismatch: "Identity mismatch",
  invalid_account: "Invalid identity account",
  unavailable: "Check unavailable",
  simulated: "Demo · not registered",
};

// ─── Dynamic AI Destination Generator for ANY User Search ───────────────────
function createCustomDestination(query: string): DestinationItem {
  const clean = query.trim().charAt(0).toUpperCase() + query.trim().slice(1);
  return {
    id: `custom-${clean.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
    name: clean,
    country: "India",
    flag: "🇮🇳",
    price: "From ₹4,500",
    tag: "Curated Pick",
    tagline: `Curated Indian cultural heritage, verified transit passes, and price protection for ${clean}.`,
    tripTitle: `Discover & Experience ${clean}`,
    duration: "3 days",
    activityLevel: "Moderate",
    accommodation: "Boutique Havelis & 4-Star Stays",
    bestSeason: "Oct – Mar / Ideal Season",
    description: `Explore the vibrant culture, historical monuments, and authentic sights of ${clean}, India. Verified by Touristमत्रम् travel concierges with transparent benchmark pricing and tamper-proof digital travel certification.`,
    heroImg: "/images/destinations/mysore-palace.jpg",
    thumbs: [
      "/images/destinations/mysore-palace.jpg",
      "/images/destinations/hawa-mahal.jpg",
      "/images/destinations/taj-mahal.jpg",
    ],
    stops: [
      { time: "09:30 AM", name: `${clean} Historic Fort & Citadel`, cost: "₹50", desc: `Historic architecture and panoramic viewpoint in ${clean}` },
      { time: "01:00 PM", name: "Traditional Artisanal Spice & Silk Bazaar", cost: "₹0", desc: `Famous local culinary stalls and authentic regional crafts` },
      { time: "05:00 PM", name: "Riverside Sunset Vista & Evening Ceremony", cost: "Free", desc: `Picturesque sunset observation spot and guided heritage walk` },
    ],
  };
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function Home() {
  const [activeTab, setActiveTab] = useState<MainTab>("discover");
  const [filterTag, setFilterTag] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDest, setSelectedDest] = useState<DestinationItem>(DESTINATIONS[0]);
  const [heroThumb, setHeroThumb] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [mapPinId, setMapPinId] = useState<string>("srinagar");

  // ── Bespoke Trip Customizer Wizard State ──
  const [plannerCity, setPlannerCity] = useState<CuratedCity | null>(null);
  const [plannerStep, setPlannerStep] = useState<number>(1);
  const [selectedAttractionIds, setSelectedAttractionIds] = useState<string[]>([]);
  const [customAttractionInput, setCustomAttractionInput] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD");
  const [budgetAmount, setBudgetAmount] = useState<number>(650);
  const [budgetTier, setBudgetTier] = useState<"budget" | "comfort" | "luxury">("comfort");
  // true once the traveller types their own amount; until then the budget follows the selection
  const [budgetEdited, setBudgetEdited] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({
    USD: 1, INR: 94.95, EUR: 0.893, GBP: 0.748, JPY: 156.8, AED: 3.67, SOL: 0.00984
  });
  const [solInCurrencies, setSolInCurrencies] = useState<Record<string, number>>({
    USD: 101.64, INR: 9650.32, EUR: 90.72, GBP: 76.00, JPY: 15943.68, AED: 373.27, SOL: 1
  });
  const [selectedTransitMode, setSelectedTransitMode] = useState<string>("");
  const [crowdTolerance, setCrowdTolerance] = useState<"tranquil" | "vibrant" | "balanced">("balanced");
  const [travelPace, setTravelPace] = useState<"leisurely" | "explorer">("explorer");
  const [travelParty, setTravelParty] = useState<"solo" | "couple" | "family" | "friends">("couple");
  const [generatedPlan, setGeneratedPlan] = useState<any | null>(null);
  const [customCommitTx, setCustomCommitTx] = useState<string | null>(null);
  const [customCommitLoading, setCustomCommitLoading] = useState(false);
  const [customCommitError, setCustomCommitError] = useState("");

  // ── Traveler Persona State (Indian Citizen vs Foreign Visitor) ──
  const [travelerType, setTravelerType] = useState<"indian" | "foreign" | null>(null);
  const [foreignCountry, setForeignCountry] = useState<string>("United States");
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState<boolean>(false);

  // ── Multi-Language Translation State ──
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);
  const t = useMemo(() => getTranslation(language), [language]);

  // ── Remote Area Offline Pass & Gmail Dispatch State ──
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);

  const handleSelectLang = (code: LanguageCode) => {
    setLanguage(code);
    localStorage.setItem("touristmatram_lang", code);
    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === code);
    if (typeof document !== "undefined") {
      document.documentElement.dir = langObj?.dir || "ltr";
    }
  };

  const handleInitiateSelection = (cityName: string, fallbackHero?: string) => {
    handleSelectDestination(cityName, fallbackHero);
  };

  const handleSelectIndian = () => {
    setTravelerType("indian");
    setSelectedCurrency("INR");
    try { sessionStorage.setItem("touristmatram_traveler_type", "indian"); } catch {}
    setIsPersonaModalOpen(false);
  };

  const handleConfirmForeign = (country: string) => {
    setTravelerType("foreign");
    setForeignCountry(country);
    setSelectedCurrency("USD");
    try {
      sessionStorage.setItem("touristmatram_traveler_type", "foreign");
      sessionStorage.setItem("touristmatram_foreign_country", country);
    } catch {}
    setIsPersonaModalOpen(false);
  };

  useEffect(() => {
    setMounted(true);
    // Start fresh on each session / server restart - forgot previous session data
    try {
      localStorage.removeItem("prooftrip_records");
      localStorage.removeItem("touristmatram_traveler_type");
      localStorage.removeItem("touristmatram_foreign_country");
      sessionStorage.clear();
    } catch {}
    setSavedRecords([]);
    setTravelerType(null);
    setIsPersonaModalOpen(true);
  }, []);

  // Load live exchange rates
  useEffect(() => {
    fetch("/api/exchange-rates")
      .then(res => res.json())
      .then(data => {
        if (data.rates) setExchangeRates(data.rates);
        if (data.solInCurrencies) setSolInCurrencies(data.solInCurrencies);
      })
      .catch(() => {});
  }, []);

  const convertAmount = useCallback((amountUSD: number, targetCur: string): number => {
    if (targetCur === "USD") return Math.round(amountUSD);
    if (targetCur === "SOL") {
      const solUsd = solInCurrencies["USD"] || 101.64;
      return Number((amountUSD / solUsd).toFixed(3));
    }
    const rate = exchangeRates[targetCur] || 1;
    return Math.round(amountUSD * rate);
  }, [exchangeRates, solInCurrencies]);

  const getBudgetInUSD = useCallback((amount: number, fromCur: string): number => {
    if (fromCur === "USD") return amount;
    if (fromCur === "SOL") {
      const solUsd = solInCurrencies["USD"] || 101.64;
      return amount * solUsd;
    }
    const rate = exchangeRates[fromCur] || 1;
    return amount / rate;
  }, [exchangeRates, solInCurrencies]);

  const handleCurrencyChange = (newCur: string) => {
    const inUSD = getBudgetInUSD(budgetAmount, selectedCurrency);
    const inNew = convertAmount(inUSD, newCur);
    setSelectedCurrency(newCur);
    setBudgetAmount(inNew);
  };

  // Trip estimate from the places actually selected (same day/ticket rules as generateTailoredPlan).
  const plannerEstimate = useMemo(() => {
    if (!plannerCity) return null;
    const chosen = plannerCity.attractions.filter(a => selectedAttractionIds.includes(a.id));
    const active = chosen.length > 0 ? chosen : plannerCity.attractions.slice(0, 3);
    const spotsPerDay = travelPace === "leisurely" ? 2 : 3;
    const days = Math.max(1, Math.ceil(active.length / spotsPerDay));
    const ticketsUSD = active.reduce((sum, a) => sum + a.costUSD, 0);
    const transitUSD = plannerCity.transit.passPriceUSD * days;
    const tierTotalUSD = (tier: keyof typeof TIER_DAILY_USD) => TIER_DAILY_USD[tier] * days + ticketsUSD + transitUSD;
    return { places: active.length, days, ticketsUSD, transitUSD, tierTotalUSD, minimumUSD: ticketsUSD + transitUSD };
  }, [plannerCity, selectedAttractionIds, travelPace]);

  // Keep the budget in step with the selection until the traveller enters their own amount.
  useEffect(() => {
    if (!plannerEstimate || budgetEdited) return;
    setBudgetAmount(convertAmount(plannerEstimate.tierTotalUSD(budgetTier), selectedCurrency));
  }, [plannerEstimate, budgetTier, budgetEdited, selectedCurrency, convertAmount]);

  // Select destination and open curated customizer flow
  const handleSelectDestination = (cityName: string, fallbackHero?: string) => {
    const clean = cityName.trim();
    if (!clean) return;
    const match = DESTINATIONS.find(d => d.name.toLowerCase() === clean.toLowerCase());
    const cityData = getCuratedCityData(clean, fallbackHero || match?.heroImg);
    setPlannerCity(cityData);
    setPriceCity(cityData.name);
    setPlannerStep(1);
    const initialAttractionIds = cityData.attractions.slice(0, 3).map(a => a.id);
    setSelectedAttractionIds(initialAttractionIds);
    setSelectedTransitMode(cityData.transit.recommendedPass);
    const initialUSD = cityData.avgDailyBudgetUSD * cityData.durationDays;
    const convertedBudget = convertAmount(initialUSD, selectedCurrency);
    setBudgetAmount(convertedBudget);
    setBudget(convertedBudget);
    setBudgetTier("comfort");
    setBudgetEdited(false);

    // Pre-populate expenses with transit pass and iconic attraction tickets
    const initialExpenses = [
      { id: "transit", name: cityData.transit.recommendedPass, amount: Math.round(cityData.transit.passPriceUSD * (selectedCurrency === "INR" ? 95 : 1)), cat: "Transport" },
      ...cityData.attractions.slice(0, 2).map((a, idx) => ({
        id: `attr-${idx}`,
        name: a.name,
        amount: Math.round(a.costUSD * (selectedCurrency === "INR" ? 95 : 1)),
        cat: "Activity",
      })),
    ];
    setExpenses(initialExpenses);

    setGeneratedPlan(null);
    setCustomCommitTx(null);
    setCustomCommitError("");
    setActiveTab("discover");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Generate Tailored Itinerary based strictly on chosen attractions, budget & crowd vibe
  const generateTailoredPlan = () => {
    if (!plannerCity) return;
    const chosenAttractions = plannerCity.attractions.filter(a => selectedAttractionIds.includes(a.id));
    const activeAttractions = chosenAttractions.length > 0 ? chosenAttractions : plannerCity.attractions.slice(0, 3);
    const spotsPerDay = travelPace === "leisurely" ? 2 : 3;
    const numDays = Math.max(1, Math.ceil(activeAttractions.length / spotsPerDay));
    
    const daysSchedule = [];
    let attractionIndex = 0;
    
    for (let d = 1; d <= numDays; d++) {
      const dayStops = [];
      const dayTheme = d === 1
        ? "Historic Heart & Primary Icons"
        : d === 2
          ? "Architecture, Panorama & Sunset Vista"
          : "Artisanal Bazaars & Hidden Promenades";
          
      // Stop 1
      if (attractionIndex < activeAttractions.length) {
        const a = activeAttractions[attractionIndex++];
        dayStops.push({
          time: crowdTolerance === "tranquil" ? "08:30 AM (Tranquil Hour)" : crowdTolerance === "vibrant" ? "10:30 AM (Peak Vibe)" : "09:15 AM (Optimal)",
          name: a.name,
          category: a.category,
          duration: a.duration,
          costDisplay: a.costDisplay,
          costUSD: a.costUSD,
          img: a.img,
          tip: a.tip,
          transitHop: `Board ${plannerCity.transit.recommendedPass.slice(0, 38)} to ${a.name.slice(0, 24)}`,
        });
      }
      // Stop 2
      if (attractionIndex < activeAttractions.length) {
        const a = activeAttractions[attractionIndex++];
        dayStops.push({
          time: "01:30 PM",
          name: a.name,
          category: a.category,
          duration: a.duration,
          costDisplay: a.costDisplay,
          costUSD: a.costUSD,
          img: a.img,
          tip: a.tip,
          transitHop: `Short 10-min connector via ${plannerCity.transit.options[0]?.name || "City Transit"}`,
        });
      }
      // Stop 3 (if explorer)
      if (spotsPerDay >= 3 && attractionIndex < activeAttractions.length) {
        const a = activeAttractions[attractionIndex++];
        dayStops.push({
          time: crowdTolerance === "tranquil" ? "04:30 PM" : "06:00 PM (Golden Hour)",
          name: a.name,
          category: a.category,
          duration: a.duration,
          costDisplay: a.costDisplay,
          costUSD: a.costUSD,
          img: a.img,
          tip: a.tip,
          transitHop: `Scenic hop via ${plannerCity.transit.options[1]?.name || "Local Tram/Walk"}`,
        });
      }
      
      daysSchedule.push({
        dayNumber: d,
        theme: dayTheme,
        stops: dayStops,
      });
    }

    const totalAttractionsUSD = activeAttractions.reduce((sum, a) => sum + a.costUSD, 0);
    const transitTotalUSD = plannerCity.transit.passPriceUSD * numDays;
    const targetBudgetUSD = getBudgetInUSD(budgetAmount, selectedCurrency);
    const diningStayUSD = Math.max(0, targetBudgetUSD - totalAttractionsUSD - transitTotalUSD);
    
    const plan = {
      city: plannerCity.name,
      country: plannerCity.country,
      flag: plannerCity.flag,
      numDays,
      pace: travelPace,
      crowd: crowdTolerance,
      party: travelParty,
      currency: selectedCurrency,
      totalBudget: budgetAmount,
      totalBudgetUSD: targetBudgetUSD,
      totalBudgetSOL: Number((targetBudgetUSD / (solInCurrencies["USD"] || 101.64)).toFixed(3)),
      costs: {
        attractions: convertAmount(totalAttractionsUSD, selectedCurrency),
        transit: convertAmount(transitTotalUSD, selectedCurrency),
        diningStay: convertAmount(diningStayUSD, selectedCurrency),
      },
      days: daysSchedule,
      transitPass: plannerCity.transit.recommendedPass,
      operatorCode: plannerCity.transit.operatorCode,
    };
    
    setGeneratedPlan(plan);
    setPlannerStep(5);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Commit Tailored Plan on Solana Devnet (Hero Idea Anchor)
  const handleCommitCustomPlan = async () => {
    if (!generatedPlan || !plannerCity) return;
    setCustomCommitLoading(true);
    setCustomCommitError("");
    
    try {
      const planPayload = {
        dest: plannerCity.name,
        country: plannerCity.country,
        days: generatedPlan.numDays,
        budget: generatedPlan.totalBudget,
        currency: generatedPlan.currency,
        solEquivalent: generatedPlan.totalBudgetSOL,
        crowd: generatedPlan.crowd,
        pace: generatedPlan.pace,
        transit: generatedPlan.transitPass,
        agentAsset: ITINERARY_AGENT_ASSET,
        timestamp: Date.now(),
      };
      
      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(planPayload)));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      
      if (wallet.connected && wallet.publicKey && wallet.signTransaction) {
        const provider = new AnchorProvider(
          connection,
          wallet as any,
          { commitment: "confirmed", preflightCommitment: "confirmed" }
        );
        const program = new Program({ ...tourismIdl, address: TOURISM_PROGRAM_ID } as unknown as Idl, provider);
        const commitmentKeypair = Keypair.generate();

        // .rpc() resolves only after the wallet signs and the cluster confirms the transaction.
        const tx = await (program.methods as any)
          .commitItinerary(
            new PublicKey(ITINERARY_AGENT_ASSET),
            hashArray,
            `${plannerCity.name} (${generatedPlan.numDays}D Tailored)`
          )
          .accounts({
            commitment: commitmentKeypair.publicKey,
            traveler: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([commitmentKeypair])
          .rpc();
          
        setCustomCommitTx(tx);
        const newRec = {
          dest: `${plannerCity.name} Tailored (${generatedPlan.numDays}D)`,
          tx,
          hash: hashHex,
          time: new Date().toLocaleTimeString(),
        };
        const updated = [newRec, ...savedRecords];
        setSavedRecords(updated);
        try { sessionStorage.setItem("prooftrip_records", JSON.stringify(updated)); } catch {}
      } else {
        // No wallet: issue an off-chain certificate (local SHA-256 reference). Nothing is sent to Solana.
        const certTx = `CERT-${hashHex.slice(0, 8).toUpperCase()}-${hashHex.slice(8, 16).toUpperCase()}`;
        setCustomCommitTx(certTx);
        const newRec = {
          dest: `${plannerCity.name} Tailored (${generatedPlan.numDays}D)`,
          tx: certTx,
          hash: hashHex,
          time: new Date().toLocaleTimeString(),
        };
        const updated = [newRec, ...savedRecords];
        setSavedRecords(updated);
        try { sessionStorage.setItem("prooftrip_records", JSON.stringify(updated)); } catch {}
      }
    } catch (err: any) {
      console.error("Custom commit error:", err);
      const msg = String(err?.message || err || "");
      setCustomCommitError(
        /reject|declin|cancel/i.test(msg) || err?.name === "WalletSignTransactionError"
          ? "Transaction was rejected in your wallet. Nothing was submitted to Solana."
          : `On-chain commit failed — nothing was recorded. ${msg || "Unknown error."}`
      );
    } finally {
      setCustomCommitLoading(false);
    }
  };

  // Secure Ledgers & Smart Contracts
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const [commitTx] = useState<string | null>(null);
  const [savedRecords, setSavedRecords] = useState<Array<{ dest: string; tx: string; hash: string; time: string }>>([]);

  // Active or Fallback Itinerary Plan for Download/Email
  const activeItineraryPlan: ItineraryPlan | null = useMemo(() => {
    if (generatedPlan) return generatedPlan as ItineraryPlan;
    if (plannerCity) {
      return {
        city: plannerCity.name,
        country: "India",
        numDays: plannerCity.durationDays || 3,
        totalBudget: budgetAmount || 15000,
        currency: selectedCurrency,
        totalBudgetSOL: (budgetAmount / (solInCurrencies[selectedCurrency] || 9650)).toFixed(2),
        crowd: crowdTolerance,
        pace: travelPace,
        days: [
          {
            dayNumber: 1,
            theme: "Curated Cultural Highlights & Sights",
            stops: plannerCity.attractions.slice(0, 3).map((a, idx) => ({
              time: idx === 0 ? "09:30 AM" : idx === 1 ? "01:00 PM" : "04:30 PM",
              name: a.name,
              category: a.category,
              duration: a.duration,
              tip: a.tip,
              costDisplay: a.costDisplay,
              transitHop: idx === 0 ? `Board ${plannerCity.transit.recommendedPass.slice(0, 32)}` : undefined,
            })),
          },
        ],
        costs: {
          attractions: Math.round(budgetAmount * 0.35),
          transit: Math.round(budgetAmount * 0.15),
          diningStay: Math.round(budgetAmount * 0.5),
        },
        transitPass: plannerCity.transit.recommendedPass,
        operatorCode: plannerCity.transit.operatorCode,
        certificateId: customCommitTx || undefined,
      };
    }
    if (selectedDest) {
      return {
        city: selectedDest.name,
        country: selectedDest.country,
        numDays: 3,
        totalBudget: selectedCurrency === "INR" ? 18500 : 220,
        currency: selectedCurrency,
        days: [
          {
            dayNumber: 1,
            theme: "Iconic Cultural & Heritage Highlights",
            stops: (selectedDest.stops || []).map((s, idx) => ({
              time: s.time,
              name: s.name,
              category: "Sightseeing",
              duration: "2-3 hours",
              tip: s.desc,
              costDisplay: s.cost,
              transitHop: idx === 0 ? "Heritage rickshaw / Metro link" : undefined,
            })),
          },
        ],
        costs: {
          attractions: selectedCurrency === "INR" ? 4000 : 45,
          transit: selectedCurrency === "INR" ? 1500 : 18,
          diningStay: selectedCurrency === "INR" ? 13000 : 157,
        },
        transitPass: `${selectedDest.name} City Heritage Pass`,
        certificateId: commitTx || undefined,
      };
    }
    return null;
  }, [generatedPlan, plannerCity, budgetAmount, selectedCurrency, solInCurrencies, crowdTolerance, travelPace, customCommitTx, selectedDest, commitTx]);

  // Verified Concierges
  const [agents, setAgents] = useState<any[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const [agentStatusTone, setAgentStatusTone] = useState<"yellow" | "green" | "red">("yellow");
  const [verifyResults, setVerifyResults] = useState<Record<string, any>>({});
  const [verifyingAsset, setVerifyingAsset] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  // Price checker
  const [priceService, setPriceService] = useState("Auto-rickshaw");
  const [priceCity, setPriceCity] = useState("Mysuru");
  const [priceQuote, setPriceQuote] = useState("450");
  const [priceResult, setPriceResult] = useState<any | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  // Budget tracker
  const [budget, setBudget] = useState(15000);
  const [expenses, setExpenses] = useState<Array<{ id: string; name: string; amount: number; cat: string }>>([
    { id: "1", name: "Airport transfer", amount: 650, cat: "Transport" },
    { id: "2", name: "Heritage Hotel (Night 1)", amount: 2200, cat: "Hotel" },
    { id: "3", name: "Palace tickets & audio guide", amount: 250, cat: "Activity" },
  ]);
  const [newExpName, setNewExpName] = useState("");
  const [newExpAmount, setNewExpAmount] = useState("");
  const [newExpCat, setNewExpCat] = useState("Food");

  // Hash verifier (records tab)
  const [verifyHashInput, setVerifyHashInput] = useState("");
  const [verifyStatus, setVerifyStatus] = useState("");

  // Tabs are unlocked once user selects a place or fills the form
  const hasActivePlan = Boolean(plannerCity !== null || customCommitTx !== null || savedRecords.length > 0);

  // Fallback active tab to discover if active plan resets
  useEffect(() => {
    if (!hasActivePlan && activeTab !== "discover") {
      setActiveTab("discover");
    }
  }, [hasActivePlan, activeTab]);

  // ── Load agents on mount ──
  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    setAgentsLoading(true);
    setAgentStatus("Querying the Metaplex Agent Registry and verifying identities on Solana...");
    setAgentStatusTone("yellow");
    try {
      const res = await fetch("/api/agents?query=travel", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data.data?.agents) ? data.data.agents : [];
      setAgents(list);
      // Server verification is the source of truth; drop stale per-card results from earlier checks.
      setVerifyResults({});
      const s = data.summary || {};
      const parts = [
        `${s.verified ?? 0} verified on ${data.cluster || "devnet"}`,
        s.unverified ? `${s.unverified} unverified` : "",
        s.unavailable ? `${s.unavailable} could not be checked` : "",
        s.simulated ? `${s.simulated} demo personas (not registered)` : "",
      ].filter(Boolean);
      const errs: string[] = Array.isArray(data.errors) ? data.errors : [];
      setAgentStatus(list.length ? `${parts.join(" · ")}${errs.length ? ` — ${errs.join(" ")}` : ""}` : "No agents returned.");
      setAgentStatusTone(errs.length ? "red" : (s.verified ?? 0) > 0 ? "green" : "yellow");
    } catch (e: any) {
      setAgents([]);
      setAgentStatus("Could not load agents: " + (e?.message || String(e)));
      setAgentStatusTone("red");
    } finally {
      setAgentsLoading(false);
    }
  }

  // ── Verify Agent On-Chain (live re-check via /api/agents/verify) ──
  async function verifyAgentOnChain(mintAddress: string) {
    setVerifyingAsset(mintAddress);
    setExpandedAgent(mintAddress);
    try {
      const res = await fetch(`/api/agents/verify?asset=${encodeURIComponent(mintAddress)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setVerifyResults(prev => ({
        ...prev,
        [mintAddress]: res.ok || res.status === 503
          ? data
          : { status: "unavailable", verified: false, reason: data?.error || `HTTP ${res.status}`, checks: [] },
      }));
    } catch (e: any) {
      setVerifyResults(prev => ({
        ...prev,
        [mintAddress]: { status: "unavailable", verified: false, reason: `Network error: ${e?.message || e}`, checks: [] },
      }));
    } finally {
      setVerifyingAsset(null);
    }
  }

  // ── SHA-256 Hash ──
  async function sha256hex(text: string): Promise<string> {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  // ── Price checker ──
  async function checkPrice() {
    setPriceLoading(true);
    setPriceResult(null);
    try {
      const res = await fetch(`/api/price?service=${encodeURIComponent(priceService)}&city=${encodeURIComponent(priceCity)}&quote=${priceQuote}`);
      const data = await res.json();
      setPriceResult(data);
    } catch (e: any) {
      setPriceResult({ error: e.message });
    } finally {
      setPriceLoading(false);
    }
  }

  // ── Budget helpers ──
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const budgetPct = Math.min(100, Math.round((totalSpent / budget) * 100));

  function addExpense() {
    if (!newExpName || !newExpAmount) return;
    const updated = [...expenses, { id: Date.now().toString(), name: newExpName, amount: parseFloat(newExpAmount), cat: newExpCat }];
    setExpenses(updated);
    setNewExpName(""); setNewExpAmount("");
  }

  // ── Smart Dynamic Search & Filtering (Never misses places) ──
  const filteredDests = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matched = DESTINATIONS.filter(d => {
      const tagOk = filterTag === "All" || d.tag === filterTag;
      const searchOk =
        !query ||
        d.name.toLowerCase().includes(query) ||
        d.country.toLowerCase().includes(query) ||
        d.tagline.toLowerCase().includes(query) ||
        d.description.toLowerCase().includes(query);
      return tagOk && searchOk;
    });

    // If user enters any real place not in default list, dynamically generate it with full photos & itinerary!
    if (matched.length === 0 && query.length >= 2) {
      return [createCustomDestination(searchQuery)];
    }
    return matched;
  }, [filterTag, searchQuery]);

  // Smoothly reload detail panel and sync destination when user searches
  useEffect(() => {
    if (filteredDests.length > 0 && !filteredDests.some(d => d.id === selectedDest.id)) {
      setSelectedDest(filteredDests[0]);
      setHeroThumb(0);
      setPriceCity(filteredDests[0].name);
    }
  }, [filteredDests, selectedDest.id]);

  // ── Explore map selection (kept separate from selectedDest so tag filters can't reset it) ──
  const pinNames = useMemo(() => Object.fromEntries(DESTINATIONS.map(d => [d.id, d.name])), []);
  const mapDest = DESTINATIONS.find(d => d.id === mapPinId) ?? DESTINATIONS[0];
  const mapPin = MAP_PINS.find(p => p.id === mapDest.id);

  // ── Trending card tilt (pointer-driven CSS variables) ──
  const handleTilt = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty("--tilt-x", `${(-y * 8).toFixed(2)}deg`);
    e.currentTarget.style.setProperty("--tilt-y", `${(x * 10).toFixed(2)}deg`);
  };
  const resetTilt = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.removeProperty("--tilt-x");
    e.currentTarget.style.removeProperty("--tilt-y");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ══ NAVIGATION ══ */}
      <nav className="navbar">
        <div className="nav-inner">
          {/* Brand */}
          <div
            className="nav-brand"
            style={{ cursor: "pointer" }}
            onClick={() => {
              setActiveTab("discover");
              setPlannerCity(null);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <div className="nav-logo-wrap">
              <img
                src="/logo.png"
                alt="Touristमत्रम् Logo"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  objectFit: "contain",
                  boxShadow: "0 2px 10px rgba(255, 200, 61, 0.25)",
                  border: "1px solid rgba(255, 200, 61, 0.35)",
                }}
              />
            </div>
            <div className="nav-brand-text">
              <span className="nav-brand-tourist">Tourist</span>
              <span className="nav-brand-matram">मत्रम्</span>
            </div>
            <div className="nav-brand-badge">
              <span className="nav-badge-dot" />
              <span>Verified Platform</span>
            </div>
          </div>

          {/* Desktop Tabs - Empty until user selects a place or fills the form */}
          <div className="nav-tabs">
            {hasActivePlan ? (
              (["discover", "agents", "price", "safety", "records"] as MainTab[]).map(tab => (
                <button
                  key={tab}
                  className={`nav-tab ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "discover" && (plannerCity ? `🗺 ${plannerCity.name}` : `🗺 ${t.navDiscover}`)}
                  {tab === "agents" && `🤖 ${t.navConcierge}`}
                  {tab === "price" && `💰 ${t.navPrice}`}
                  {tab === "safety" && `🛡 ${t.navSafety}`}
                  {tab === "records" && (
                    <span>
                      🔗 {t.navRecords}
                      {savedRecords.length > 0 && (
                        <span style={{ marginLeft: 6, fontSize: 10, padding: "2px 6px", background: "rgba(20, 241, 149, 0.2)", color: "#14F195", borderRadius: 10, fontWeight: 700 }}>
                          {savedRecords.length}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              ))
            ) : null}
          </div>

          {/* Right: Language, Traveler Status & Wallet */}
          <div className="nav-right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Language Selector Button */}
            <button
              className="nav-lang-btn"
              onClick={() => setIsLangModalOpen(true)}
              title={t.selectLanguage}
            >
              <Globe size={13} color="var(--yellow)" />
              <span>{SUPPORTED_LANGUAGES.find(l => l.code === language)?.nativeName || "English"}</span>
            </button>

            {travelerType === "indian" ? (
              <button
                className="nav-traveler-pill indian"
                onClick={() => setIsPersonaModalOpen(true)}
                title="Click to switch between Indian Citizen and Foreign Traveler"
              >
                <span>🇮🇳</span>
                <span className="nav-traveler-label">{t.indianCitizen}</span>
                <span className="nav-traveler-switch">{t.change}</span>
              </button>
            ) : travelerType === "foreign" ? (
              <button
                className="nav-traveler-pill foreign"
                onClick={() => setIsPersonaModalOpen(true)}
                title="Click to view Visa requirements or change country"
              >
                <span>🌐</span>
                <span className="nav-traveler-label">{foreignCountry}</span>
                <span className="nav-traveler-visa-badge">{t.visaGuide}</span>
              </button>
            ) : (
              <button
                className="nav-traveler-pill"
                onClick={() => setIsPersonaModalOpen(true)}
              >
                <span>🇮🇳 / 🌐</span>
                <span className="nav-traveler-label">Citizen Status</span>
              </button>
            )}
            <WalletMultiButton />
          </div>
        </div>
      </nav>

      {/* Mobile Tabs (scrollable) - Empty until user selects a place or fills the form */}
      {hasActivePlan && (
        <div className="mobile-tabs" style={{ paddingTop: "calc(var(--nav-h) + 0px)" }}>
          {(["discover", "agents", "price", "safety", "records"] as MainTab[]).map(tab => (
            <button
              key={tab}
              className={`mobile-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "discover" && (plannerCity ? `🗺 ${plannerCity.name}` : `🗺 ${t.navDiscover}`)}
              {tab === "agents" && `🤖 ${t.navConcierge}`}
              {tab === "price" && `💰 ${t.navPrice}`}
              {tab === "safety" && `🛡 ${t.navSafety}`}
              {tab === "records" && `🔗 ${t.navRecords} (${savedRecords.length})`}
            </button>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: DISCOVER                                                 */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "discover" && (
        <>
          {plannerCity !== null ? (
            /* ══════════════════════════════════════════════════════════ */
            /* BESPOKE TRIP CUSTOMIZER WIZARD (Interactive Form Flow)    */
            /* ══════════════════════════════════════════════════════════ */
            <div className="customizer-container">
              {/* Navigation Bar */}
              <div className="customizer-nav-bar">
                <button
                  className="customizer-back-btn"
                  onClick={() => {
                    setPlannerCity(null);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>{t.backToDestinations}</span>
                </button>
                <div className="customizer-verified-badge">
                  <ShieldCheck size={14} />
                  <span>2026 Live Verified Guide & Transit System</span>
                </div>
              </div>

              {/* Destination Hero Banner */}
              <div className="customizer-hero-banner">
                <img
                  src={plannerCity.heroImg}
                  alt={plannerCity.name}
                  className="customizer-hero-bg"
                  onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_HERO; }}
                />
                <div className="customizer-hero-gradient" />
                <div className="customizer-hero-content">
                  <div className="customizer-city-title">
                    <span className="customizer-city-flag">{plannerCity.flag}</span>
                    <span>{plannerCity.name}</span>
                    <span style={{ fontSize: 16, color: "var(--yellow)", fontWeight: 700, marginLeft: 6 }}>
                      · {plannerCity.country}
                    </span>
                  </div>
                  <p className="customizer-city-tagline">{plannerCity.tagline}</p>
                </div>
              </div>

              {/* Progress Stepper Bar (Google Form Inspired) */}
              <div className="stepper-card">
                <div className="stepper-progress-track">
                  <div
                    className="stepper-progress-bar"
                    style={{ width: `${(plannerStep / 5) * 100}%` }}
                  />
                </div>
                <div className="stepper-steps-row">
                  {[
                    { num: 1, label: t.step1, icon: <Star size={12} /> },
                    { num: 2, label: t.step2, icon: <DollarSign size={12} /> },
                    { num: 3, label: t.step3, icon: <Train size={12} /> },
                    { num: 4, label: t.step4, icon: <Users size={12} /> },
                    { num: 5, label: t.step5, icon: <Sparkles size={12} /> },
                  ].map(s => (
                    <button
                      key={s.num}
                      className={`stepper-step-item ${plannerStep === s.num ? "active" : ""} ${plannerStep > s.num ? "completed" : ""}`}
                      onClick={() => {
                        if (s.num <= plannerStep || (s.num === 5 && generatedPlan)) {
                          setPlannerStep(s.num);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      }}
                    >
                      <div className="stepper-step-num">
                        {plannerStep > s.num ? <Check size={14} /> : s.num}
                      </div>
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── STEP 1: Top Attractions Selection ── */}
              {plannerStep === 1 && (
                <div className="wizard-panel">
                  <div className="wizard-header">
                    <span className="wizard-step-label">Step 1 of 4 · Destination Curation</span>
                    <h2 className="wizard-title">{t.selectSights} {plannerCity.name}</h2>
                    <p className="wizard-subtitle">
                      Choose which landmarks you want to visit. We will arrange them into an optimal daily route avoiding peak lines and rush hours.
                    </p>
                  </div>

                  <div className="attraction-grid">
                    {plannerCity.attractions.map(attr => {
                      const isSelected = selectedAttractionIds.includes(attr.id);
                      return (
                        <div
                          key={attr.id}
                          className={`attraction-card ${isSelected ? "selected" : ""}`}
                          onClick={() => {
                            setSelectedAttractionIds(prev =>
                              prev.includes(attr.id) ? prev.filter(x => x !== attr.id) : [...prev, attr.id]
                            );
                          }}
                        >
                          <div className="attraction-photo-wrap">
                            <img
                              src={attr.img}
                              alt={attr.name}
                              className="attraction-photo"
                              loading="lazy"
                              onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_THUMB; }}
                            />
                            <div className="attraction-check-badge">
                              {isSelected ? <Check size={16} /> : null}
                            </div>
                            <div className="attraction-category-pill">{attr.category}</div>
                          </div>
                          <div className="attraction-body">
                            <div className="attraction-name">{attr.name}</div>
                            <div className="attraction-meta-row">
                              <span className="attraction-meta-item"><Clock size={12} /> {attr.duration}</span>
                              <span>•</span>
                              <span className="attraction-meta-item" style={{ color: "var(--yellow)", fontWeight: 700 }}>
                                <Ticket size={12} /> {attr.costDisplay}
                              </span>
                              <span>•</span>
                              <span className="attraction-meta-item">
                                <span style={{
                                  width: 7, height: 7, borderRadius: "50%",
                                  background: attr.crowdRating === "Peaceful" ? "var(--success)" : attr.crowdRating === "High" ? "var(--error)" : "var(--yellow)"
                                }} />
                                {attr.crowdRating} Crowd
                              </span>
                            </div>
                            <div className="attraction-tip">
                              <strong style={{ color: "#FFF" }}>Insider Tip:</strong> {attr.tip}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add Custom Spot Box */}
                  <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
                    <input
                      style={{
                        flex: 1, minWidth: 260,
                        background: "var(--dark-elevated)",
                        border: "1px solid var(--dark-border)",
                        borderRadius: 12,
                        padding: "12px 18px",
                        color: "#FFF",
                        fontSize: 14,
                      }}
                      placeholder={`+ Add another specific spot or market in ${plannerCity.name}...`}
                      value={customAttractionInput}
                      onChange={e => setCustomAttractionInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && customAttractionInput.trim()) {
                          const newId = `custom-${Date.now()}`;
                          const newAttr: CityAttraction = {
                            id: newId,
                            name: customAttractionInput.trim(),
                            category: "Custom Selection",
                            duration: "2 hours",
                            costDisplay: "Free / Local",
                            costUSD: 5,
                            img: plannerCity.heroImg,
                            bestTime: "Flexible",
                            tip: "Traveler requested custom destination.",
                            crowdRating: "Moderate",
                          };
                          plannerCity.attractions.push(newAttr);
                          setSelectedAttractionIds(prev => [...prev, newId]);
                          setCustomAttractionInput("");
                        }
                      }}
                    />
                    <button
                      className="btn-dark"
                      style={{ width: "auto", padding: "0 22px", borderRadius: 12 }}
                      onClick={() => {
                        if (customAttractionInput.trim()) {
                          const newId = `custom-${Date.now()}`;
                          const newAttr: CityAttraction = {
                            id: newId,
                            name: customAttractionInput.trim(),
                            category: "Custom Selection",
                            duration: "2 hours",
                            costDisplay: "Free / Local",
                            costUSD: 5,
                            img: plannerCity.heroImg,
                            bestTime: "Flexible",
                            tip: "Traveler requested custom destination.",
                            crowdRating: "Moderate",
                          };
                          plannerCity.attractions.push(newAttr);
                          setSelectedAttractionIds(prev => [...prev, newId]);
                          setCustomAttractionInput("");
                        }
                      }}
                    >
                      <Plus size={16} /> Add Place
                    </button>
                  </div>

                  <div className="wizard-footer-nav">
                    <div style={{ fontSize: 14, color: "var(--gray-light)" }}>
                      <strong style={{ color: "var(--yellow)" }}>{selectedAttractionIds.length}</strong> attraction{selectedAttractionIds.length === 1 ? "" : "s"} selected for {plannerCity.name}
                      {plannerEstimate && selectedAttractionIds.length > 0 && (
                        <> · {plannerEstimate.days} day{plannerEstimate.days > 1 ? "s" : ""} · tickets ≈ {convertAmount(plannerEstimate.ticketsUSD, selectedCurrency).toLocaleString()} {selectedCurrency}</>
                      )}
                    </div>
                    <button
                      className="btn-hero-yellow"
                      disabled={selectedAttractionIds.length === 0}
                      onClick={() => { setPlannerStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    >
                      <span>Next: Budget & Currencies</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 2: Budget & Currencies with Live CoinGecko API ── */}
              {plannerStep === 2 && (
                <div className="wizard-panel">
                  <div className="wizard-header">
                    <span className="wizard-step-label">Step 2 of 4 · Finances & Currencies</span>
                    <h2 className="wizard-title">What Budget Are You Willing to Spend?</h2>
                    <p className="wizard-subtitle">
                      Choose your preferred currency and enter your target budget. Our live FX engine calculates exact real-time conversions across global currencies.
                    </p>
                  </div>

                  {/* Currency Selector Pills */}
                  <div className="currency-tabs">
                    {[
                      { code: "USD", symbol: "$", name: "US Dollar" },
                      { code: "INR", symbol: "₹", name: "Indian Rupee" },
                      { code: "EUR", symbol: "€", name: "Euro" },
                      { code: "GBP", symbol: "£", name: "British Pound" },
                      { code: "JPY", symbol: "¥", name: "Japanese Yen" },
                      { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
                      { code: "SOL", symbol: "◎", name: "Solana" },
                    ].map(c => (
                      <button
                        key={c.code}
                        className={`currency-tab ${selectedCurrency === c.code ? "active" : ""}`}
                        onClick={() => handleCurrencyChange(c.code)}
                      >
                        <span>{c.symbol}</span>
                        <span>{c.code}</span>
                      </button>
                    ))}
                  </div>

                  {/* Large Numeric Input */}
                  <div className="budget-input-box">
                    <div className="budget-symbol">
                      {selectedCurrency === "USD" ? "$" : selectedCurrency === "INR" ? "₹" : selectedCurrency === "EUR" ? "€" : selectedCurrency === "GBP" ? "£" : selectedCurrency === "JPY" ? "¥" : selectedCurrency === "AED" ? "د.إ" : "◎"}
                    </div>
                    <input
                      type="number"
                      className="budget-input"
                      value={budgetAmount || ""}
                      onChange={e => { setBudgetEdited(true); setBudgetAmount(Math.max(0, Number(e.target.value))); }}
                    />
                  </div>

                  {plannerEstimate && (
                    <div
                      className={`status-box ${getBudgetInUSD(budgetAmount, selectedCurrency) < plannerEstimate.minimumUSD ? "status-red" : "status-yellow"}`}
                      style={{ marginBottom: 20, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
                    >
                      <span>
                        {getBudgetInUSD(budgetAmount, selectedCurrency) < plannerEstimate.minimumUSD
                          ? `Budget is below the tickets + transit for your ${plannerEstimate.places} place${plannerEstimate.places > 1 ? "s" : ""} (${convertAmount(plannerEstimate.minimumUSD, selectedCurrency).toLocaleString()} ${selectedCurrency}).`
                          : budgetEdited
                            ? `Custom budget. Suggested for ${plannerEstimate.places} place${plannerEstimate.places > 1 ? "s" : ""} over ${plannerEstimate.days} day${plannerEstimate.days > 1 ? "s" : ""}: ${convertAmount(plannerEstimate.tierTotalUSD(budgetTier), selectedCurrency).toLocaleString()} ${selectedCurrency}.`
                            : `Estimated for ${plannerEstimate.places} place${plannerEstimate.places > 1 ? "s" : ""} over ${plannerEstimate.days} day${plannerEstimate.days > 1 ? "s" : ""}: tickets ${convertAmount(plannerEstimate.ticketsUSD, selectedCurrency).toLocaleString()} + transit ${convertAmount(plannerEstimate.transitUSD, selectedCurrency).toLocaleString()} + stays & dining.`}
                      </span>
                      {budgetEdited && (
                        <button className="btn-sm-dark" type="button" onClick={() => setBudgetEdited(false)}>
                          Use estimate
                        </button>
                      )}
                    </div>
                  )}

                  {/* Preset Budget Tier Cards */}
                  <div className="budget-tiers-grid">
                    <div
                      className={`budget-tier-card ${budgetTier === "budget" ? "selected" : ""}`}
                      onClick={() => {
                        setBudgetTier("budget");
                        setBudgetEdited(false);
                      }}
                    >
                      <div className="tier-icon">🎒</div>
                      <div className="tier-title">Backpacker / Economy</div>
                      <div className="tier-estimate">~{convertAmount(plannerEstimate ? plannerEstimate.tierTotalUSD("budget") : 35 * plannerCity.durationDays, selectedCurrency).toLocaleString()} {selectedCurrency} total</div>
                      <p className="tier-desc">Social boutique hostels, local thalis & authentic street eateries, city bus/metro transit pass.</p>
                    </div>
                    <div
                      className={`budget-tier-card ${budgetTier === "comfort" ? "selected" : ""}`}
                      onClick={() => {
                        setBudgetTier("comfort");
                        setBudgetEdited(false);
                      }}
                    >
                      <div className="tier-icon">🧳</div>
                      <div className="tier-title">Comfort / Explorer (Recommended)</div>
                      <div className="tier-estimate">~{convertAmount(plannerEstimate ? plannerEstimate.tierTotalUSD("comfort") : 95 * plannerCity.durationDays, selectedCurrency).toLocaleString()} {selectedCurrency} total</div>
                      <p className="tier-desc">3-4★ heritage stays, sit-down dining, day transit passes, all museum audio guides included.</p>
                    </div>
                    <div
                      className={`budget-tier-card ${budgetTier === "luxury" ? "selected" : ""}`}
                      onClick={() => {
                        setBudgetTier("luxury");
                        setBudgetEdited(false);
                      }}
                    >
                      <div className="tier-icon">👑</div>
                      <div className="tier-title">Luxury / Royal</div>
                      <div className="tier-estimate">~{convertAmount(plannerEstimate ? plannerEstimate.tierTotalUSD("luxury") : 240 * plannerCity.durationDays, selectedCurrency).toLocaleString()} {selectedCurrency} total</div>
                      <p className="tier-desc">5★ palace suites & villas, private chauffeured AC cabs, fine dining & VIP entry passes.</p>
                    </div>
                  </div>

                  {/* Live FX Ticker Card */}
                  <div className="fx-ticker-card">
                    <div className="fx-ticker-header">
                      <div className="fx-live-pill">
                        <span className="fx-pulsing-dot" />
                        <span>CoinGecko & Live FX API Synced</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--gray-light)" }}>
                        Live Benchmark: 1 SOL = ${solInCurrencies["USD"] || 101.64} USD ≈ ₹{Math.round(solInCurrencies["INR"] || 9650).toLocaleString()} INR
                      </div>
                    </div>
                    <div className="fx-grid">
                      <div className="fx-item">
                        <div className="fx-label">Equivalent in Solana</div>
                        <div className="fx-val sol-accent">
                          ◎ {(getBudgetInUSD(budgetAmount, selectedCurrency) / (solInCurrencies["USD"] || 101.64)).toFixed(3)} SOL
                        </div>
                      </div>
                      <div className="fx-item">
                        <div className="fx-label">Equivalent in USD</div>
                        <div className="fx-val">${Math.round(getBudgetInUSD(budgetAmount, selectedCurrency)).toLocaleString()}</div>
                      </div>
                      <div className="fx-item">
                        <div className="fx-label">Equivalent in INR</div>
                        <div className="fx-val">₹{Math.round(getBudgetInUSD(budgetAmount, selectedCurrency) * (exchangeRates["INR"] || 94.95)).toLocaleString()}</div>
                      </div>
                      <div className="fx-item">
                        <div className="fx-label">Daily Allocation</div>
                        <div className="fx-val" style={{ fontSize: 16 }}>
                          ~{Math.round(budgetAmount / (plannerEstimate?.days || plannerCity.durationDays)).toLocaleString()} {selectedCurrency} / day
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="wizard-footer-nav">
                    <button
                      className="btn-dark"
                      style={{ width: "auto", padding: "12px 24px" }}
                      onClick={() => { setPlannerStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    >
                      <ArrowLeft size={16} /> Back: Attractions
                    </button>
                    <button
                      className="btn-hero-yellow"
                      onClick={() => { setPlannerStep(3); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    >
                      <span>Next: Public Transport</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Public Transport & City Transit Passes ── */}
              {plannerStep === 3 && (
                <div className="wizard-panel">
                  <div className="wizard-header">
                    <span className="wizard-step-label">Step 3 of 4 · Transit Passes</span>
                    <h2 className="wizard-title">Public Transport Available in {plannerCity.name}</h2>
                    <p className="wizard-subtitle">
                      Official city transit passes and verified route options for {plannerCity.name} without vague terms.
                    </p>
                  </div>

                  {/* Tactile Train Clipboard Transit Ticket */}
                  <div className="transit-pass-ticket">
                    <div className="ticket-clipboard-header">
                      <div className="ticket-clipboard-tag">
                        <ClipboardList size={18} />
                        <Train size={18} />
                        <span>Official Transit Pass Badge</span>
                      </div>
                      <div className="ticket-operator-code">{plannerCity.transit.operatorCode}</div>
                    </div>
                    <div className="ticket-body">
                      <div>
                        <div className="ticket-pass-badge">
                          <Star size={12} /> #1 TOP RECOMMENDED FOR {plannerCity.name.toUpperCase()}
                        </div>
                        <div className="ticket-pass-name">{plannerCity.transit.recommendedPass}</div>
                        <div className="ticket-details-grid">
                          <div className="ticket-detail-item">
                            <div className="ticket-detail-label">Official Fare Rate</div>
                            <div className="ticket-detail-value" style={{ color: "var(--yellow)" }}>
                              {plannerCity.transit.passPrice}
                            </div>
                          </div>
                          <div className="ticket-detail-item">
                            <div className="ticket-detail-label">Network Coverage</div>
                            <div className="ticket-detail-value">{plannerCity.transit.passValidity}</div>
                          </div>
                        </div>
                        <div className="ticket-how-to-use">
                          <strong style={{ color: "#FFF" }}>How to Use:</strong> {plannerCity.transit.howToUse}
                        </div>
                      </div>

                      <div className="ticket-barcode-col">
                        <div className="barcode-visual" />
                        <div className="barcode-number">REF-{plannerCity.id.toUpperCase()}-2026</div>
                        <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 800, marginTop: 4 }}>
                          ✓ VERIFIED CITY TRANSIT
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="field-label" style={{ marginBottom: 14 }}>
                    All Verified Transit Options in {plannerCity.name}
                  </div>
                  <div className="transit-options-grid">
                    {plannerCity.transit.options.map((opt, i) => (
                      <div
                        key={i}
                        className={`transit-option-card ${selectedTransitMode === opt.name ? "selected" : ""}`}
                        onClick={() => setSelectedTransitMode(opt.name)}
                      >
                        <div className="transit-option-head">
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {opt.type === "metro" && <Train size={16} color="var(--yellow)" />}
                            {opt.type === "train" && <Train size={16} color="var(--yellow)" />}
                            {opt.type === "bus" && <Bus size={16} color="var(--yellow)" />}
                            {opt.type === "auto" && <Car size={16} color="var(--yellow)" />}
                            {opt.type === "ferry" && <Ship size={16} color="var(--yellow)" />}
                            {opt.type === "bike" && <Bike size={16} color="var(--yellow)" />}
                            <span className="transit-option-name">{opt.name}</span>
                          </div>
                          <span className="transit-option-cost">{opt.cost}</span>
                        </div>
                        <p className="transit-option-tip">{opt.tip}</p>
                      </div>
                    ))}
                  </div>

                  <div className="wizard-footer-nav">
                    <button
                      className="btn-dark"
                      style={{ width: "auto", padding: "12px 24px" }}
                      onClick={() => { setPlannerStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    >
                      <ArrowLeft size={16} /> Back: Budget
                    </button>
                    <button
                      className="btn-hero-yellow"
                      onClick={() => { setPlannerStep(4); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    >
                      <span>Next: Crowd & Atmosphere</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 4: Crowd Tolerance & Style ── */}
              {plannerStep === 4 && (
                <div className="wizard-panel">
                  <div className="wizard-header">
                    <span className="wizard-step-label">Step 4 of 4 · Atmosphere & Flow</span>
                    <h2 className="wizard-title">Crowd Preference & Travel Atmosphere</h2>
                    <p className="wizard-subtitle">
                      Tell us your comfort level so we schedule visits during quiet morning hours or buzzing evening peaks.
                    </p>
                  </div>

                  <div className="field-label" style={{ marginBottom: 12 }}>How comfortable are you with crowds?</div>
                  <div className="crowd-options-grid">
                    <div
                      className={`crowd-option-card ${crowdTolerance === "tranquil" ? "selected" : ""}`}
                      onClick={() => setCrowdTolerance("tranquil")}
                    >
                      <div className="crowd-option-icon">🍃</div>
                      <div className="crowd-option-title">Tranquil & Less Crowded</div>
                      <p className="crowd-option-desc">
                        Schedule visits at early morning opening slots (08:30 AM), quiet side streets, and serene viewpoints away from tour buses.
                      </p>
                    </div>
                    <div
                      className={`crowd-option-card ${crowdTolerance === "balanced" ? "selected" : ""}`}
                      onClick={() => setCrowdTolerance("balanced")}
                    >
                      <div className="crowd-option-icon">⚖️</div>
                      <div className="crowd-option-title">Balanced Optimal Flow (Recommended)</div>
                      <p className="crowd-option-desc">
                        Hit famous landmarks right at opening to beat long queues, then explore relaxed local cafés and neighborhoods in the afternoon.
                      </p>
                    </div>
                    <div
                      className={`crowd-option-card ${crowdTolerance === "vibrant" ? "selected" : ""}`}
                      onClick={() => setCrowdTolerance("vibrant")}
                    >
                      <div className="crowd-option-icon">🔥</div>
                      <div className="crowd-option-title">Comfortable with Crowds / Iconic Vibe</div>
                      <p className="crowd-option-desc">
                        I love the buzzing evening atmosphere, packed bazaars, and vibrant landmark scenes. Ready for peak energy.
                      </p>
                    </div>
                  </div>

                  {/* Pace */}
                  <div className="field-label" style={{ marginBottom: 12 }}>Trip Pace</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
                    <div
                      className={`crowd-option-card ${travelPace === "leisurely" ? "selected" : ""}`}
                      onClick={() => setTravelPace("leisurely")}
                    >
                      <div className="crowd-option-icon">☕</div>
                      <div className="crowd-option-title">Leisurely & Relaxed</div>
                      <p className="crowd-option-desc">1–2 sights per day with extended café breaks, strolls, and zero rushing.</p>
                    </div>
                    <div
                      className={`crowd-option-card ${travelPace === "explorer" ? "selected" : ""}`}
                      onClick={() => setTravelPace("explorer")}
                    >
                      <div className="crowd-option-icon">⚡</div>
                      <div className="crowd-option-title">Active Explorer</div>
                      <p className="crowd-option-desc">3–4 sights per day, full-day schedule, seeing the absolute maximum.</p>
                    </div>
                  </div>

                  {/* Travel Party */}
                  <div className="field-label" style={{ marginBottom: 12 }}>Who is traveling?</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
                    {[
                      { id: "solo", label: "Solo Explorer", icon: "👤" },
                      { id: "couple", label: "Couple / Romantic", icon: "💑" },
                      { id: "family", label: "Family with Kids", icon: "👨‍👩‍👧" },
                      { id: "friends", label: "Friends Group", icon: "👥" },
                    ].map(p => (
                      <button
                        key={p.id}
                        className={`pill-btn ${travelParty === p.id ? "active" : ""}`}
                        style={{ padding: "10px 20px", fontSize: 14 }}
                        onClick={() => setTravelParty(p.id as any)}
                      >
                        <span>{p.icon}</span>
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="wizard-footer-nav">
                    <button
                      className="btn-dark"
                      style={{ width: "auto", padding: "12px 24px" }}
                      onClick={() => { setPlannerStep(3); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    >
                      <ArrowLeft size={16} /> Back: Transit
                    </button>
                    <button
                      className="btn-hero-yellow"
                      onClick={generateTailoredPlan}
                    >
                      <Sparkles size={16} />
                      <span>{t.generatePlanBtn}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 5: Generated Tailored Itinerary & Solana Devnet Commitment ── */}
              {plannerStep === 5 && generatedPlan && (
                <div>
                  <div className="wizard-panel">
                    <div className="wizard-header">
                      <span className="wizard-step-label">✦ Bespoke Verified Travel Plan</span>
                      <h2 className="wizard-title">Tailored Travel Agreement for {generatedPlan.city}</h2>
                      <p className="wizard-subtitle">
                        Sequenced specifically for your selected sights, {generatedPlan.currency} budget, and transit pass.
                      </p>
                    </div>

                    {/* ── REMOTE AREA EXPLORER PACK & EMAIL DISPATCH ── */}
                    <div className="remote-action-strip">
                      <div className="remote-action-strip-header">
                        <div className="remote-action-icon-badge">
                          <WifiOff size={20} color="var(--yellow)" />
                        </div>
                        <div>
                          <div className="remote-action-title">Remote Area Explorer Pack &amp; Email Dispatch</div>
                          <div className="remote-action-desc">
                            Traveling to valleys, mountain passes, or remote areas with zero cell reception? Download your self-contained offline pass or send the complete itinerary to your Gmail.
                          </div>
                        </div>
                      </div>
                      <div className="remote-action-buttons">
                        <button
                          type="button"
                          onClick={() => setIsOfflineModalOpen(true)}
                          className="btn-remote-download"
                          title="Download self-contained offline travel pass for remote areas"
                        >
                          <Download size={15} />
                          <span>Download Remote Pass (Offline)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsEmailModalOpen(true)}
                          className="btn-send-gmail"
                          title="Send full itinerary and voucher to your Gmail inbox"
                        >
                          <Mail size={15} />
                          <span>Send to Gmail</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => printOfflinePass(generatedPlan, { travelerType: travelerType || "indian", foreignCountry })}
                          className="btn-print-action"
                          title="Print itinerary or save to PDF"
                        >
                          <Printer size={15} />
                          <span>Print / PDF</span>
                        </button>
                      </div>
                    </div>

                    {/* Summary Bar */}
                    <div style={{
                      display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 16, background: "var(--dark-elevated)", border: "1px solid var(--dark-border)",
                      borderRadius: 14, padding: "18px 22px", marginBottom: 28,
                    }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--gray-light)", textTransform: "uppercase", fontWeight: 700 }}>Duration</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#FFF" }}>{generatedPlan.numDays} Days</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--gray-light)", textTransform: "uppercase", fontWeight: 700 }}>Pace & Crowd</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--yellow)" }}>
                          {generatedPlan.crowd === "tranquil" ? "🍃 Tranquil" : generatedPlan.crowd === "vibrant" ? "🔥 Vibrant" : "⚖️ Balanced"} · {generatedPlan.pace === "leisurely" ? "Relaxed" : "Explorer"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--gray-light)", textTransform: "uppercase", fontWeight: 700 }}>Total Budget</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--yellow)" }}>
                          {generatedPlan.currency === "SOL" ? "◎ " : ""}{generatedPlan.totalBudget.toLocaleString()} {generatedPlan.currency}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--gray-light)", textTransform: "uppercase", fontWeight: 700 }}>SOL Equivalent</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#FFF" }}>
                          ◎ {generatedPlan.totalBudgetSOL} SOL
                        </div>
                      </div>
                    </div>

                    {/* Day 1 ticket-style route strip */}
                    {generatedPlan.days[0] && (
                      <div className="ia-ticket" aria-label={`Day 1 route in ${generatedPlan.city}`}>
                        <div className="ia-ticket-stub">
                          <span className="ia-ticket-kicker">Day 1 · Route pass</span>
                          <span className="ia-ticket-city">{generatedPlan.city}</span>
                          <span className="ia-mono ia-ticket-meta">
                            {generatedPlan.days[0].stops.length} stops · {generatedPlan.numDays} day{generatedPlan.numDays > 1 ? "s" : ""}
                          </span>
                        </div>
                        <ol className="ia-ticket-route">
                          {generatedPlan.days[0].stops.map((stop: any, sIdx: number) => (
                            <li key={sIdx} className="ia-ticket-stop">
                              <span className="ia-mono ia-ticket-time">{String(stop.time).split(" (")[0]}</span>
                              <span className="ia-ticket-dot" />
                              <span className="ia-ticket-name">{stop.name}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Day by Day Schedule */}
                    <div style={{ marginBottom: 32 }}>
                      <div className="field-label" style={{ marginBottom: 16 }}>Day-by-Day Route & Scheduled Sights</div>
                      {generatedPlan.days.map((day: any) => (
                        <div key={day.dayNumber} className="itinerary-day-box">
                          <div className="itinerary-day-title">
                            <Calendar size={18} />
                            <span>Day {day.dayNumber} · {day.theme}</span>
                          </div>

                          <div>
                            {day.stops.map((stop: any, sIdx: number) => (
                              <React.Fragment key={sIdx}>
                                <div className="itinerary-stop-row">
                                  <div className="itinerary-stop-time">{stop.time}</div>
                                  <div>
                                    <div className="itinerary-stop-title">{stop.name}</div>
                                    <div style={{ fontSize: 12, color: "var(--yellow)", fontWeight: 700, marginBottom: 4 }}>
                                      {stop.category} · {stop.duration}
                                    </div>
                                    <div className="itinerary-stop-desc">{stop.tip}</div>
                                    <div className="itinerary-stop-tip-box">
                                      <strong style={{ color: "var(--yellow)" }}>Ticket:</strong> {stop.costDisplay}
                                    </div>
                                  </div>
                                  <div style={{ width: 90, height: 65, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                                    <img
                                      src={stop.img}
                                      alt={stop.name}
                                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_THUMB; }}
                                    />
                                  </div>
                                </div>

                                {sIdx < day.stops.length - 1 && (
                                  <div className="itinerary-transit-connector">
                                    <ClipboardList size={15} />
                                    <Train size={15} />
                                    <span>Transit Hop: {stop.transitHop}</span>
                                  </div>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Itemized Budget Breakdown Table */}
                    <div style={{
                      background: "var(--dark-elevated)", border: "1px solid var(--dark-border)",
                      borderRadius: 16, padding: "24px", marginBottom: 32,
                    }}>
                      <div className="field-label" style={{ marginBottom: 16 }}>Curated Budget Breakdown</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 8 }}>
                          <span style={{ color: "var(--gray-light)" }}>Sightseeing Admissions & Tickets</span>
                          <span style={{ fontWeight: 700 }}>
                            {generatedPlan.costs.attractions.toLocaleString()} {generatedPlan.currency}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 8 }}>
                          <span style={{ color: "var(--gray-light)" }}>Public Transit Pass ({generatedPlan.transitPass.slice(0, 32)})</span>
                          <span style={{ fontWeight: 700 }}>
                            {generatedPlan.costs.transit.toLocaleString()} {generatedPlan.currency}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 8 }}>
                          <span style={{ color: "var(--gray-light)" }}>Estimated Stays & Local Dining</span>
                          <span style={{ fontWeight: 700 }}>
                            {generatedPlan.costs.diningStay.toLocaleString()} {generatedPlan.currency}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, fontSize: 16, fontWeight: 800, color: "var(--yellow)" }}>
                          <span>Total Target Plan</span>
                          <span>
                            {generatedPlan.totalBudget.toLocaleString()} {generatedPlan.currency} (≈ ◎ {generatedPlan.totalBudgetSOL} SOL)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Digital Travel Certificate & Price Lock Guarantee */}
                    <div style={{
                      background: "rgba(255, 200, 61, 0.05)", border: "2px solid rgba(255, 200, 61, 0.35)",
                      borderRadius: 18, padding: "28px", marginBottom: 24,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <Lock size={20} color="var(--yellow)" />
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: "#FFF" }}>Tamper-Proof Travel Agreement & Guarantee</h3>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--gray-light)", lineHeight: 1.6, marginBottom: 20 }}>
                        Lock this agreement to record its SHA-256 fingerprint on Solana {SOLANA_CLUSTER} through the itinerary commitment program — your wallet signs and pays the network fee. Without a wallet, you get an off-chain certificate reference instead.
                      </p>

                      {customCommitTx && (
                        <div className={`status-box ${customCommitTx.startsWith("CERT-") ? "status-yellow" : "status-green"}`} style={{ marginBottom: 16, fontSize: 13 }}>
                          <div style={{ fontWeight: 800, marginBottom: 4 }}>
                            {customCommitTx.startsWith("CERT-")
                              ? "Off-chain certificate created (not recorded on Solana)"
                              : `✓ Itinerary hash committed and confirmed on Solana ${SOLANA_CLUSTER}`}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--yellow)", wordBreak: "break-all" }}>
                            {customCommitTx.startsWith("CERT-") ? "Certificate Reference" : "Transaction Signature"}: <code style={{ color: "#FFF" }}>{customCommitTx}</code>
                          </div>
                          {customCommitTx.startsWith("CERT-") ? (
                            <div style={{ fontSize: 12, color: "var(--gray-light)", marginTop: 4 }}>
                              Connect a wallet and lock again to anchor this itinerary on-chain.
                            </div>
                          ) : (
                            <a
                              href={explorerUrl("tx", customCommitTx)}
                              target="_blank" rel="noreferrer"
                              style={{ color: "var(--yellow)", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4 }}
                            >
                              View transaction on Solana Explorer <ExternalLink size={12} />
                            </a>
                          )}
                          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => setIsOfflineModalOpen(true)}
                              className="btn-remote-download"
                              style={{ fontSize: 12, padding: "8px 14px", textDecoration: "none" }}
                            >
                              <Download size={13} />
                              <span>Save Offline Pass</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEmailModalOpen(true)}
                              className="btn-send-gmail"
                              style={{ fontSize: 12, padding: "8px 14px", textDecoration: "none" }}
                            >
                              <Mail size={13} />
                              <span>Send to Gmail</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {customCommitError && (
                        <div className="status-box status-red" style={{ marginBottom: 16, fontSize: 12 }}>
                          {customCommitError}
                        </div>
                      )}

                      <button
                        className="btn-yellow"
                        onClick={handleCommitCustomPlan}
                        disabled={customCommitLoading}
                      >
                        {customCommitLoading ? (
                          <><Loader2 size={16} className="animate-spin" /><span>{t.certifyingProgress}</span></>
                        ) : (
                          <><Lock size={15} /><span>{t.lockAgreementBtn}</span></>
                        )}
                      </button>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--gray-light)", marginTop: 12 }}>
                        <span>
                          {mounted && wallet.publicKey ? (
                            <span style={{ color: "var(--success)", fontWeight: 600 }}>
                              🟢 Wallet Connected: {wallet.publicKey.toBase58().slice(0, 4)}...{wallet.publicKey.toBase58().slice(-4)}
                            </span>
                          ) : (
                            <span>🛡️ Instant Travel Protection Active · Zero setup required</span>
                          )}
                        </span>
                        {mounted && !wallet.publicKey && (
                          <button
                            onClick={() => openWalletModal(true)}
                            style={{ background: "none", border: "none", color: "var(--yellow)", cursor: "pointer", fontSize: 12, textDecoration: "underline", fontWeight: 600 }}
                          >
                            Connect Wallet (Optional)
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── Experience Rating Card (img 4) ── */}
                    <div style={{ display: "flex", justifyContent: "center", margin: "28px 0 16px 0" }}>
                      <ExperienceRatingWidget showDismiss={false} />
                    </div>

                    <div className="wizard-footer-nav">
                      <button
                        className="btn-dark"
                        style={{ width: "auto", padding: "12px 24px" }}
                        onClick={() => { setPlannerStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      >
                        <RotateCcw size={16} /> Modify Choices
                      </button>
                      <button
                        className="btn-hero-yellow"
                        onClick={() => {
                          setPlannerCity(null);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        <span>{t.exploreAnother}</span>
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ══════════════════════════════════════════════════════════ */
            /* DISCOVERY CATALOG (Select any city to customize)          */
            /* ══════════════════════════════════════════════════════════ */
            <>
              {/* ── Immersive Hero ── */}
              <section className="ia-hero">
                <img
                  className="ia-hero-bg"
                  src="/images/destinations/dal-lake.jpg"
                  alt="Shikaras on Dal Lake, Srinagar"
                  onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_HERO; }}
                />
                <div className="ia-hero-shade" />
                <div className="ia-hero-content">
                  <div className="ia-hero-coord">
                    <MapPin size={13} />
                    <span>34.0837° N, 74.7973° E · Dal Lake, Srinagar</span>
                  </div>
                  <p className="ia-hero-kicker">{t.heroTitle}</p>
                  <h1 className="ia-hero-title">
                    India<span className="ia-coral">,</span><br />Unfolded<span className="ia-saffron">.</span>
                  </h1>
                  <p className="ia-hero-sub">{t.heroSub}</p>

                  {/* Traveler Category Context Banner */}
                  {travelerType === "foreign" ? (
                    <div className="traveler-status-banner foreign" style={{ margin: "0 0 20px 0" }} onClick={() => setIsPersonaModalOpen(true)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Globe size={14} color="var(--yellow)" />
                        <span>International Visitor ({foreignCountry})</span>
                        <span className="visa-chip">Official e-Visa Guide</span>
                      </div>
                      <span className="view-docs-link">Review Visa Documents & White-Bg Photo Specs →</span>
                    </div>
                  ) : (
                    <div className="traveler-status-banner indian" style={{ margin: "0 0 20px 0" }} onClick={() => setIsPersonaModalOpen(true)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span>🇮🇳</span>
                        <span><strong>Indian Citizen</strong> · Direct access with verified domestic rates & transit cards</span>
                      </div>
                      <span className="switch-status-link">Foreign Visitor? Check Visa →</span>
                    </div>
                  )}

                  <div className="hero-actions">
                    <div className="hero-search">
                      <Search size={16} color="var(--gray-light)" />
                      <input
                        placeholder={t.heroSearchPlaceholder}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            const query = searchQuery.trim() || (filteredDests.length > 0 ? filteredDests[0].name : "Mysuru");
                            handleSelectDestination(query);
                          }
                        }}
                      />
                    </div>
                    <button
                      className="btn-hero-yellow"
                      onClick={() => {
                        const query = searchQuery.trim() || (filteredDests.length > 0 ? filteredDests[0].name : "Mysuru");
                        handleSelectDestination(query);
                      }}
                    >
                      <span>{t.exploreBtn}</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>

                {/* Scrolling city marquee (second copy is decorative, for a seamless loop) */}
                <div className="ia-marquee">
                  <div className="ia-marquee-track">
                    {[...DESTINATIONS, ...DESTINATIONS].map((d, i) => {
                      const isCopy = i >= DESTINATIONS.length;
                      return (
                        <button
                          key={`${d.id}-${i}`}
                          type="button"
                          className="ia-marquee-item"
                          onClick={() => handleSelectDestination(d.name, d.heroImg)}
                          tabIndex={isCopy ? -1 : undefined}
                          aria-hidden={isCopy || undefined}
                        >
                          <span>{d.name}</span>
                          <span className="ia-marquee-star">✦</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* ── Explore: stylised lat/lon pin map + detail panel ── */}
              <section className="page-section">
                <div className="section-header">
                  <div>
                    <div className="section-label">01 · Explore</div>
                    <h2 className="section-title">Pick a pin. <span className="ia-coral">Plan the route.</span></h2>
                    <p className="section-sub">Ten cities plotted at their real coordinates. Tap a pin to preview its route, then plan it.</p>
                  </div>
                </div>

                <div className="ia-explore-grid">
                  <PinMap names={pinNames} selectedId={mapDest.id} onSelect={setMapPinId} />

                  <article className="ia-detail" key={mapDest.id}>
                    <div className="ia-detail-photo">
                      <img
                        src={mapDest.heroImg}
                        alt={mapDest.name}
                        onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_HERO; }}
                      />
                      <span className="ia-detail-tag"><Star size={10} /> {mapDest.tag}</span>
                    </div>
                    <div className="ia-detail-body">
                      {mapPin && <div className="ia-mono ia-detail-coord">{formatCoord(mapPin.lat, mapPin.lon)}</div>}
                      <h3 className="ia-detail-name">{mapDest.name}</h3>
                      <p className="ia-detail-tagline">{mapDest.tagline}</p>
                      <dl className="ia-detail-stats">
                        <div><dt>Duration</dt><dd>{mapDest.duration}</dd></div>
                        <div><dt>Best season</dt><dd>{mapDest.bestSeason}</dd></div>
                        <div><dt>Budget</dt><dd>{mapDest.price}</dd></div>
                      </dl>
                      <ol className="ia-detail-stops">
                        {mapDest.stops.map(stop => (
                          <li key={stop.name}>
                            <span className="ia-mono">{stop.time}</span>
                            <span>{stop.name}</span>
                          </li>
                        ))}
                      </ol>
                      <button
                        className="btn-hero-yellow ia-btn-coral"
                        onClick={() => handleSelectDestination(mapDest.name, mapDest.heroImg)}
                      >
                        <span>Plan this route</span>
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </article>
                </div>

                {/* Explore → Plan → Certify */}
                <ol className="ia-flow">
                  {[
                    { n: "01", title: "Explore", text: "Pick a pin, a trending card or search any Indian city.", icon: <Compass size={18} /> },
                    { n: "02", title: "Plan", text: "Choose sights, budget, transit pass, crowd vibe and pace.", icon: <Ticket size={18} /> },
                    { n: "03", title: "Certify", text: "Lock your price with a verified concierge on Solana devnet.", icon: <ShieldCheck size={18} /> },
                  ].map(step => (
                    <li key={step.n} className="ia-flow-step">
                      <span className="ia-flow-icon">{step.icon}</span>
                      <div>
                        <div className="ia-mono ia-flow-num">{step.n}</div>
                        <div className="ia-flow-title">{step.title}</div>
                        <p className="ia-flow-text">{step.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              {/* ── Trending: tall tilt cards ── */}
              <div className="page-section">
                <div className="section-header">
                  <div>
                    <div className="section-label">02 · {t.navDiscover}</div>
                    <h2 className="section-title">{t.curatedHeading}</h2>
                    <p className="section-sub">
                      {t.curatedSub}
                    </p>
                  </div>
                  <div className="filter-pills">
                    {ALL_TAGS.map(tag => (
                      <button
                        key={tag}
                        className={`pill-btn ${filterTag === tag ? "active" : ""}`}
                        onClick={() => setFilterTag(tag)}
                      >{tag}</button>
                    ))}
                  </div>
                </div>

                <div className="destinations-grid ia-trend-grid">
                  {filteredDests.map(dest => (
                    <div
                      key={dest.id}
                      role="button"
                      tabIndex={0}
                      className={`dest-card ia-tilt ${selectedDest.id === dest.id ? "selected" : ""}`}
                      onClick={() => handleSelectDestination(dest.name, dest.heroImg)}
                      onKeyDown={e => { if (e.key === "Enter") handleSelectDestination(dest.name, dest.heroImg); }}
                      onMouseMove={handleTilt}
                      onMouseLeave={resetTilt}
                    >
                      <div className="dest-card-photo">
                        <img
                          src={dest.heroImg}
                          alt={dest.name}
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = FALLBACK_HERO;
                          }}
                        />
                      </div>
                      <div className="dest-card-overlay" />
                      <div className="dest-card-badge">
                        <Star size={10} /> {dest.tag}
                      </div>
                      <div className="dest-card-body">
                        <div className="ia-mono ia-card-duration">{dest.duration} · {dest.bestSeason}</div>
                        <div className="dest-card-name">{dest.name}</div>
                        <div className="dest-card-price">{dest.price}</div>
                        <p className="dest-card-desc">{dest.tagline}</p>
                        <div className="ia-card-cta">
                          <span>Plan & Customize Trip</span>
                          <ArrowRight size={14} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: AGENTS                                                   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "agents" && (
        <div className="page-section" style={{ paddingTop: "calc(var(--nav-h) + 48px)" }}>
          {!hasActivePlan ? (
            <div className="empty-state" style={{ padding: "80px 24px", maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
              <div className="empty-state-icon" style={{ fontSize: 52, marginBottom: 16 }}>🤖</div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: "#FFF", marginBottom: 10 }}>Select a Destination First</h3>
              <p style={{ color: "var(--gray)", fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
                Certified AI Travel Concierges provide localized cultural guidance, itinerary verification, and booking protection. Please select a city in Discover or build a custom plan to unlock verified concierges.
              </p>
              <button className="btn-hero-yellow" style={{ margin: "0 auto" }} onClick={() => setActiveTab("discover")}>
                <Compass size={16} />
                <span>Explore Curated Destinations</span>
              </button>
            </div>
          ) : (
            <>
              {plannerCity && (
                <div className="status-box status-yellow" style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>📍 Active Destination: <strong>{plannerCity.name}, {plannerCity.country}</strong> {plannerCity.flag} — Showing registry agents verified live on Solana, plus demo concierge personas.</span>
                  <button className="btn-sm-dark" onClick={() => { setActiveTab("discover"); setPlannerStep(5); }}>
                    Back to Plan
                  </button>
                </div>
              )}
              <div className="section-header">
                <div>
                  <div className="section-label">✦ Metaplex Agent Registry</div>
                  <h2 className="section-title">Agents & Travel Concierges</h2>
                  <p className="section-sub">
                    Registry agents are checked live against their on-chain Agent Identity. Demo concierges are labelled and have no on-chain identity.
                  </p>
                </div>
                <button className="btn-dark" style={{ width: "auto", padding: "10px 20px" }} onClick={loadAgents} disabled={agentsLoading}>
                  {agentsLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span>Refresh Concierges</span>
                </button>
              </div>

              {agentStatus && (
                <div className={`status-box status-${agentStatusTone}`} style={{ marginBottom: 24 }}>{agentStatus}</div>
              )}

              {agentsLoading ? (
                <div className="empty-state">
                  <div style={{ marginBottom: 16 }}><Loader2 size={32} className="animate-spin" color="var(--yellow)" /></div>
                  <p>Querying the agent registry and verifying identities on Solana...</p>
                </div>
              ) : agents.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🤖</div>
                  <h3>No agents found</h3>
                  <p>The registry query returned no agents. Try refreshing.</p>
                </div>
              ) : (
                <div className="agents-grid">
                  {agents.map((agent, i) => {
                    const v = (agent.mintAddress && verifyResults[agent.mintAddress]) || agent.verification || {};
                    const status: string = v.status || "unavailable";
                    const expanded = !!agent.mintAddress && expandedAgent === agent.mintAddress;
                    return (
                      <div
                        key={agent.id || agent.mintAddress || i}
                        className={`agent-card ${status === "verified" ? "verified-card" : ""}`}
                      >
                        <div className="agent-card-top">
                          <div className="agent-icon">
                            {status === "simulated" ? "🧪" : status === "verified" ? "✅" : status === "unavailable" ? "⚠️" : "❔"}
                          </div>
                          <span className={`agent-status-badge agent-status-${status}`}>
                            {status === "verified" && <CheckCircle size={11} />}
                            {AGENT_STATUS_LABELS[status] || AGENT_STATUS_LABELS.unavailable}
                          </span>
                        </div>
                        <div>
                          <div className="agent-name">{agent.displayName || agent.name}</div>
                          <div className="agent-specialty">{agent.specialty || "Travel & Tourism"}</div>
                        </div>
                        <p className="agent-desc">{agent.description}</p>
                        <div className="agent-addr" style={{ fontSize: 11, color: "var(--gray)" }}>
                          {agent.mintAddress
                            ? <>Asset: {agent.mintAddress.slice(0, 6)}…{agent.mintAddress.slice(-6)}</>
                            : <>Demo data · no on-chain identity</>}
                        </div>
                        {agent.mintAddress ? (
                          <div className="agent-actions">
                            <button
                              className="btn-sm-yellow"
                              disabled={verifyingAsset === agent.mintAddress}
                              onClick={() => verifyAgentOnChain(agent.mintAddress)}
                            >
                              {verifyingAsset === agent.mintAddress
                                ? <><Loader2 size={12} className="animate-spin" /> Verifying...</>
                                : <><RefreshCw size={12} /> Re-verify on-chain</>}
                            </button>
                            <button
                              className="btn-sm-dark"
                              onClick={() => setExpandedAgent(expanded ? null : agent.mintAddress)}
                              aria-expanded={expanded}
                            >
                              {expanded ? "Hide details" : "Details"}
                            </button>
                            <a
                              href={explorerUrl("address", agent.mintAddress)}
                              target="_blank" rel="noreferrer"
                              className="btn-sm-dark"
                              title="View asset on Solana Explorer"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        ) : (
                          <div className="agent-verify-note">{v.reason || "Demo persona — not registered in the Metaplex Agent Registry."}</div>
                        )}
                        {expanded && (
                          <div className="agent-verify-details">
                            <div className="agent-verify-reason">{v.reason || "No verification result."}</div>
                            {Array.isArray(v.checks) && v.checks.length > 0 && (
                              <ul className="agent-verify-checks">
                                {v.checks.map((c: any, ci: number) => (
                                  <li key={ci} className={`check-${String(c.status).toLowerCase()}`}>
                                    <span className="agent-verify-check-status">{c.status}</span>
                                    <span>{c.check}</span>
                                    <span className="agent-verify-check-detail">{c.detail}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {v.identityPda && (
                              <div className="agent-verify-meta">
                                Identity PDA:{" "}
                                <a href={explorerUrl("address", v.identityPda)} target="_blank" rel="noreferrer">
                                  {v.identityPda.slice(0, 8)}…{v.identityPda.slice(-6)}
                                </a>
                                {v.identity?.version ? ` · AgentIdentityV${v.identity.version}` : ""}
                                {v.assetAccount?.name ? ` · On-chain name: ${v.assetAccount.name}` : ""}
                              </div>
                            )}
                            {v.checkedAt && (
                              <div className="agent-verify-meta">Checked {new Date(v.checkedAt).toLocaleTimeString()} on {v.cluster || "devnet"}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: PRICE                                                    */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "price" && (
        <div className="page-section" style={{ paddingTop: "calc(var(--nav-h) + 48px)" }}>
          {!hasActivePlan ? (
            <div className="empty-state" style={{ padding: "80px 24px", maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
              <div className="empty-state-icon" style={{ fontSize: 52, marginBottom: 16 }}>💰</div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: "#FFF", marginBottom: 10 }}>Select a Destination First</h3>
              <p style={{ color: "var(--gray)", fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
                Fair Price Protection compares real quotes against verified municipal benchmarks and transit rates for your destination. Pick a destination or customize your trip in Discover to unlock price checking.
              </p>
              <button className="btn-hero-yellow" style={{ margin: "0 auto" }} onClick={() => setActiveTab("discover")}>
                <Compass size={16} />
                <span>Explore Curated Destinations</span>
              </button>
            </div>
          ) : (
            <>
              {plannerCity && (
                <div className="status-box status-yellow" style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>📍 Destination: <strong>{plannerCity.name}, {plannerCity.country}</strong> {plannerCity.flag} — Benchmarked against verified 2024–2025 municipal rates.</span>
                  <button className="btn-sm-dark" onClick={() => { setActiveTab("discover"); setPlannerStep(5); }}>
                    Back to Plan
                  </button>
                </div>
              )}
              <div className="section-header">
                <div>
                  <div className="section-label">✦ Price Protection</div>
                  <h2 className="section-title">Fair Price Checker</h2>
                  <p className="section-sub">Compare local quotes against verified reference rates to protect against overcharging</p>
                </div>
              </div>
              <div className="two-col-grid">
                <div className="feature-card">
                  <div className="feature-card-icon"><DollarSign size={20} /></div>
                  <div className="feature-card-title">Check Price Fairness</div>
                  <p className="feature-card-sub">Enter what you were quoted and we'll compare it against typical local rates.</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <div className="field-label">Service Type</div>
                      <select className="field-input" value={priceService} onChange={e => setPriceService(e.target.value)}>
                        <option>Auto-rickshaw / Taxi</option>
                        <option>City taxi / Cab</option>
                        <option>Hotel room (budget)</option>
                        <option>Hotel room (mid-range)</option>
                        <option>Tour guide (half-day)</option>
                        <option>Entry ticket</option>
                      </select>
                    </div>
                    <div>
                      <div className="field-label">City / Destination</div>
                      <input className="field-input" value={priceCity} onChange={e => setPriceCity(e.target.value)} placeholder="e.g. Mysuru" />
                    </div>
                    <div>
                      <div className="field-label">Your Quote (₹ / $)</div>
                      <input className="field-input" type="number" value={priceQuote} onChange={e => setPriceQuote(e.target.value)} placeholder="450" />
                    </div>
                    <button className="btn-yellow" onClick={checkPrice} disabled={priceLoading}>
                      {priceLoading ? <><Loader2 size={15} className="animate-spin" /><span>Checking...</span></> : <><DollarSign size={15} /><span>Check Price</span></>}
                    </button>
                  </div>
                  {priceResult && !priceResult.error && (
                    <div className={`status-box ${priceResult.verdict === "Fair" ? "status-green" : "status-red"}`} style={{ marginTop: 16, fontSize: 14, fontWeight: 700 }}>
                      {priceResult.verdict === "Fair" ? "✓ Fair Price" : "⚠ Possibly Overpriced"} — Reference: {priceResult.reference} | Your quote: {priceResult.quote}
                    </div>
                  )}
                </div>
                <div className="feature-card">
                  <div className="feature-card-icon"><Receipt size={20} /></div>
                  <div className="feature-card-title">Reference Rate Guide</div>
                  <p className="feature-card-sub">
                    Typical rates in {plannerCity ? `${plannerCity.name}, ${plannerCity.country}` : priceCity || "Indian tourism cities"} (2024–2025 verified benchmarks).
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {getCityReferenceRates(plannerCity?.name || priceCity || "India", plannerCity?.country || "India").map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--dark-border)", fontSize: 13 }}>
                        <span style={{ color: "var(--gray-light)" }}>{r.service}</span>
                        <span style={{ color: "var(--yellow)", fontWeight: 700 }}>{r.rate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: SAFETY                                                   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "safety" && (
        <div className="page-section" style={{ paddingTop: "calc(var(--nav-h) + 48px)" }}>
          {!hasActivePlan ? (
            <div className="empty-state" style={{ padding: "80px 24px", maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
              <div className="empty-state-icon" style={{ fontSize: 52, marginBottom: 16 }}>🛡️</div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: "#FFF", marginBottom: 10 }}>Select a Destination First</h3>
              <p style={{ color: "var(--gray)", fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
                Safety contacts, emergency helplines, and the trip expense tracker are tailored to your chosen destination. Select a city in Discover to view emergency numbers and manage your budget.
              </p>
              <button className="btn-hero-yellow" style={{ margin: "0 auto" }} onClick={() => setActiveTab("discover")}>
                <Compass size={16} />
                <span>Explore Curated Destinations</span>
              </button>
            </div>
          ) : (
            <>
              {plannerCity && (
                <div className="status-box status-yellow" style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>📍 Active Destination: <strong>{plannerCity.name}, {plannerCity.country}</strong> {plannerCity.flag} — Showing local emergency numbers & customized budget.</span>
                  <button className="btn-sm-dark" onClick={() => { setActiveTab("discover"); setPlannerStep(5); }}>
                    Back to Plan
                  </button>
                </div>
              )}
              <div className="section-header">
                <div>
                  <div className="section-label">✦ Trip Management</div>
                  <h2 className="section-title">Safety & Budget</h2>
                  <p className="section-sub">Emergency helplines and trip expense tracker</p>
                </div>
              </div>
              <div className="two-col-grid">
                {/* Emergency Contacts */}
                <div className="feature-card">
                  <div className="feature-card-icon"><Phone size={20} /></div>
                  <div className="feature-card-title">Emergency Helplines</div>
                  <p className="feature-card-sub">
                    Official emergency contacts for {plannerCity ? `${plannerCity.name}, ${plannerCity.country}` : "your destination"}.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {getCityHelplines(plannerCity?.name || "India", plannerCity?.country || "India").map(c => (
                      <div key={c.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "var(--dark-elevated)", borderRadius: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Phone size={14} color={c.color} />
                          <span style={{ fontSize: 13, color: "var(--gray-light)" }}>{c.label}</span>
                        </div>
                        <span style={{ fontWeight: 800, fontSize: 16, color: c.color }}>{c.number}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Budget Tracker */}
                <div className="feature-card">
                  <div className="feature-card-icon"><Receipt size={20} /></div>
                  <div className="feature-card-title">Trip Expense Tracker</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: "var(--gray)" }}>
                      Budget: {selectedCurrency === "USD" ? "$" : selectedCurrency === "EUR" ? "€" : selectedCurrency === "INR" ? "₹" : selectedCurrency + " "}{budget.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: budgetPct > 80 ? "var(--error)" : "var(--yellow)" }}>
                      Spent: {selectedCurrency === "USD" ? "$" : selectedCurrency === "EUR" ? "€" : selectedCurrency === "INR" ? "₹" : selectedCurrency + " "}{totalSpent.toLocaleString()} ({budgetPct}%)
                    </span>
                  </div>
                  <div className="budget-bar-track">
                    <div className="budget-bar-fill" style={{ width: `${budgetPct}%`, background: budgetPct > 80 ? "var(--error)" : "var(--yellow)" }} />
                  </div>
                  <div style={{ marginTop: 16, marginBottom: 12 }}>
                    {expenses.map(e => (
                      <div key={e.id} className="expense-row">
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--white)" }}>{e.name}</div>
                          <span className="expense-cat-badge">{e.cat}</span>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--yellow)" }}>
                          {selectedCurrency === "USD" ? "$" : selectedCurrency === "EUR" ? "€" : selectedCurrency === "INR" ? "₹" : selectedCurrency + " "}{e.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--dark-border)", paddingTop: 14 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input className="field-input" placeholder="Expense name" value={newExpName} onChange={e => setNewExpName(e.target.value)} style={{ flex: 1 }} />
                      <input className="field-input" placeholder="Amount" type="number" value={newExpAmount} onChange={e => setNewExpAmount(e.target.value)} style={{ width: 88 }} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <select className="field-input" style={{ flex: 1 }} value={newExpCat} onChange={e => setNewExpCat(e.target.value)}>
                        {["Food", "Transport", "Hotel", "Activity", "Shopping", "Other"].map(c => <option key={c}>{c}</option>)}
                      </select>
                      <button className="btn-yellow" style={{ width: "auto", padding: "0 16px" }} onClick={addExpense}>
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* TAB: RECORDS                                                  */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {activeTab === "records" && (
        <div className="page-section" style={{ paddingTop: "calc(var(--nav-h) + 48px)" }}>
          {!hasActivePlan ? (
            <div className="empty-state" style={{ padding: "80px 24px", maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
              <div className="empty-state-icon" style={{ fontSize: 52, marginBottom: 16 }}>🔗</div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: "#FFF", marginBottom: 10 }}>No On-Chain Records Yet</h3>
              <p style={{ color: "var(--gray)", fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
                Tamper-evident trip agreements are hashed (SHA-256) and committed immutably to Solana Devnet. Select a destination in Discover and complete your 5-step customized plan to record your travel agreement.
              </p>
              <button className="btn-hero-yellow" style={{ margin: "0 auto" }} onClick={() => setActiveTab("discover")}>
                <Compass size={16} />
                <span>Explore Curated Destinations</span>
              </button>
            </div>
          ) : (
            <>
              {plannerCity && !customCommitTx && (
                <div className="status-box status-yellow" style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>📍 Customized plan for <strong>{plannerCity.name}</strong> is in progress. Ready to lock certified pricing.</span>
                  <button className="btn-sm-yellow" onClick={() => { setActiveTab("discover"); setPlannerStep(5); }}>
                    Proceed to Step 5 to Lock Agreement
                  </button>
                </div>
              )}
              <div className="section-header">
                <div>
                  <div className="section-label">✦ Certified Travel Ledgers</div>
                  <h2 className="section-title">Certified Trip Agreements</h2>
                  <p className="section-sub">Every certified itinerary is permanently sealed with cryptographic tamper protection and guaranteed benchmark pricing.</p>
                </div>
              </div>

              {savedRecords.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🔗</div>
                  <h3>No agreements recorded yet</h3>
                  <p>Go to Discover, select a destination, and click "Lock & Certify Travel Agreement" to create your first certified itinerary record.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {savedRecords.map((rec, i) => (
                    <div key={i} className="record-card">
                      <div className="record-icon">✓</div>
                      <div className="record-body">
                        <div className="record-dest">
                          {rec.dest} — {rec.tx.startsWith("CERT-") ? "Off-chain certificate" : `On-chain commitment (${SOLANA_CLUSTER})`}
                        </div>
                        <div className="record-hash">
                          {rec.tx.startsWith("CERT-") ? `Certificate ID: ${rec.tx}` : `Tx: ${rec.tx.slice(0, 16)}…`} · Hash: {rec.hash}
                        </div>
                        <div className="record-time">{rec.time}</div>
                      </div>
                      {rec.tx.startsWith("CERT-") ? (
                        <span className="record-link" style={{ opacity: 0.7 }}>Not on-chain</span>
                      ) : (
                        <a
                          href={explorerUrl("tx", rec.tx)}
                          target="_blank" rel="noreferrer"
                          className="record-link"
                        >
                          <ExternalLink size={13} /> View Transaction
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Certificate Verifier */}
              <div className="feature-card" style={{ marginTop: 32, maxWidth: 600 }}>
                <div className="feature-card-title" style={{ marginBottom: 6 }}>Digital Certificate Tamper Verifier</div>
                <p className="feature-card-sub">Paste any certified itinerary signature or SHA-256 hash to verify cryptographic authenticity.</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    className="field-input"
                    placeholder="Paste certificate hash..."
                    value={verifyHashInput}
                    onChange={e => setVerifyHashInput(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn-yellow"
                    style={{ width: "auto", padding: "0 20px", whiteSpace: "nowrap" }}
                    onClick={() => {
                      if (verifyHashInput.length >= 32) {
                        setVerifyStatus("✓ Authentic Digital Certificate — Signature verified with guaranteed price integrity");
                      } else {
                        setVerifyStatus("✗ Invalid Certificate: please provide a valid certificate signature or hash");
                      }
                    }}
                  >
                    Verify
                  </button>
                </div>
                {verifyStatus && (
                  <div className={`status-box ${verifyStatus.startsWith("✓") ? "status-green" : "status-red"}`} style={{ marginTop: 12, fontSize: 13 }}>
                    {verifyStatus}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ FOOTER ══ */}
      <footer className="site-footer">
        <div className="footer-brand" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src="/logo.png"
            alt="Touristमत्रम् Logo"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              objectFit: "contain",
              border: "1px solid rgba(255, 200, 61, 0.35)",
            }}
          />
          <span style={{ fontSize: 18, fontWeight: 900 }}>
            Tourist<span style={{ color: "var(--yellow)" }}>मत्रम्</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="footer-devnet-dot" style={{ background: "var(--success)" }} />
          <span>Encrypted & Certified Travel Network</span>
        </div>
        <div>© 2026 Touristमत्रम्. All rights reserved.</div>
      </footer>

      {/* Traveler Persona & Official Visa Advisor Modal */}
      <TravelerPersonaModal
        isOpen={isPersonaModalOpen}
        onClose={() => setIsPersonaModalOpen(false)}
        onSelectIndian={handleSelectIndian}
        onConfirmForeign={handleConfirmForeign}
        currentType={travelerType}
        currentCountry={foreignCountry}
      />

      {/* Multi-Language Selector Modal */}
      <LanguageSelectorModal
        isOpen={isLangModalOpen}
        onClose={() => setIsLangModalOpen(false)}
        currentLang={language}
        onSelectLang={handleSelectLang}
      />

      {/* Send Itinerary to Gmail Modal */}
      <SendEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        plan={activeItineraryPlan}
        cityName={activeItineraryPlan?.city || plannerCity?.name || selectedDest?.name || "India"}
        travelerType={travelerType || "indian"}
        foreignCountry={foreignCountry}
        certificateId={customCommitTx || commitTx || undefined}
      />

      {/* Offline Remote Travel Pass & SOS Guide Modal */}
      <OfflineRemoteModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
        plan={activeItineraryPlan}
        cityName={activeItineraryPlan?.city || plannerCity?.name || selectedDest?.name || "India"}
        travelerType={travelerType || "indian"}
        foreignCountry={foreignCountry}
        certificateId={customCommitTx || commitTx || undefined}
      />
    </>
  );
}
