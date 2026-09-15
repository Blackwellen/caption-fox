import {
  Globe, Boxes, LayoutGrid, Wallet, CalendarCheck, Star, Clock, Languages,
  Users, TrendingUp, Briefcase, MapPin, FileText, Receipt, ShieldCheck, Truck,
} from 'lucide-react'
import {
  BUDGET_BANDS, RATING_BANDS, TURNAROUND_BANDS, AUDIENCE_BANDS, ENGAGEMENT_BANDS,
  PLATFORM_LABELS, REGIONS, LANGUAGES, SUPPLIER_TYPE_LABELS,
  ESCROW_META, DELIVERY_META, REQUEST_STATUS_META,
  type MarketplaceCategory,
} from '@/lib/marketplace/module'
import type { HeroFilter } from './SearchHero'

const ICON = 16

function options(pairs: [string, string][], anyLabel: string) {
  return [{ value: '', label: anyLabel }, ...pairs.map(([value, label]) => ({ value, label }))]
}

const regionOptions = options(REGIONS.map(region => [region, region] as [string, string]), 'Any location')
const platformOptions = options(Object.entries(PLATFORM_LABELS) as [string, string][], 'All platforms')
const languageOptions = options(LANGUAGES.map(language => [language, language] as [string, string]), 'Any language')
const budgetOptions = BUDGET_BANDS.map(band => ({ value: band.id, label: band.label }))
const ratingOptions = RATING_BANDS.map(band => ({ value: band.id, label: band.label }))
const speedOptions = TURNAROUND_BANDS.map(band => ({ value: band.id, label: band.label }))
const audienceOptions = AUDIENCE_BANDS.map(band => ({ value: band.id, label: band.label }))
const engagementOptions = ENGAGEMENT_BANDS.map(band => ({ value: band.id, label: band.label }))
const availabilityOptions = [{ value: '', label: 'Anytime' }, { value: '1', label: 'Available now' }]

function categoryOptions(categories: MarketplaceCategory[], anyLabel = 'All categories') {
  return options(categories.map(category => [category.slug, category.name] as [string, string]), anyLabel)
}

/** Broad discovery: location, category, platform, budget, rating, speed, availability. */
export function discoverFilters(categories: MarketplaceCategory[]): HeroFilter[] {
  return [
    { key: 'region', label: 'Location', icon: <Globe size={ICON} />, options: regionOptions },
    { key: 'category', label: 'Category', icon: <Boxes size={ICON} />, options: categoryOptions(categories) },
    { key: 'platform', label: 'Platform', icon: <LayoutGrid size={ICON} />, options: platformOptions },
    { key: 'budget', label: 'Budget', icon: <Wallet size={ICON} />, options: budgetOptions },
    { key: 'rating', label: 'Rating', icon: <Star size={ICON} />, options: ratingOptions },
    { key: 'turnaround', label: 'Delivery', icon: <Truck size={ICON} />, options: speedOptions },
    { key: 'available', label: 'Availability', icon: <CalendarCheck size={ICON} />, options: availabilityOptions },
  ]
}

/** Influencer search: niche, platform, audience location, size, engagement, budget, availability. */
export function influencerFilters(): HeroFilter[] {
  const niches = ['Fitness', 'Beauty', 'Skincare', 'Technology', 'Travel', 'Food', 'Motivation', 'Lifestyle', 'Gaming']
  return [
    { key: 'tag', label: 'Niche', icon: <TrendingUp size={ICON} />, options: options(niches.map(n => [n, n] as [string, string]), 'Any niche') },
    { key: 'platform', label: 'Platform', icon: <LayoutGrid size={ICON} />, options: platformOptions },
    { key: 'region', label: 'Audience location', icon: <MapPin size={ICON} />, options: regionOptions },
    { key: 'audience', label: 'Audience size', icon: <Users size={ICON} />, options: audienceOptions },
    { key: 'engagement', label: 'Engagement rate', icon: <TrendingUp size={ICON} />, options: engagementOptions },
    { key: 'budget', label: 'Budget', icon: <Wallet size={ICON} />, options: budgetOptions },
    { key: 'available', label: 'Availability', icon: <CalendarCheck size={ICON} />, options: availabilityOptions },
  ]
}

/** Services search: category, turnaround, budget, rating, response time, region. */
export function serviceFilters(categories: MarketplaceCategory[]): HeroFilter[] {
  const types = (['agency', 'freelancer', 'ads_manager'] as const).map(type => [type, SUPPLIER_TYPE_LABELS[type]] as [string, string])
  return [
    { key: 'category', label: 'Service category', icon: <Briefcase size={ICON} />, options: categoryOptions(categories) },
    { key: 'type', label: 'Specialisation', icon: <Boxes size={ICON} />, options: options(types, 'All specialisations') },
    { key: 'turnaround', label: 'Turnaround time', icon: <Clock size={ICON} />, options: speedOptions },
    { key: 'budget', label: 'Budget range', icon: <Wallet size={ICON} />, options: budgetOptions },
    { key: 'rating', label: 'Minimum rating', icon: <Star size={ICON} />, options: ratingOptions },
    { key: 'region', label: 'Region', icon: <Globe size={ICON} />, options: regionOptions },
    { key: 'language', label: 'Language', icon: <Languages size={ICON} />, options: languageOptions },
  ]
}

/** UGC creator search: niche, platform, region, language, budget, availability, performance. */
export function ugcFilters(): HeroFilter[] {
  const niches = ['Skincare', 'Beauty', 'Wellness', 'Tech', 'SaaS', 'Fitness', 'Gaming', 'Lifestyle', 'Unboxing']
  return [
    { key: 'tag', label: 'Niche', icon: <TrendingUp size={ICON} />, options: options(niches.map(n => [n, n] as [string, string]), 'Any niche') },
    { key: 'platform', label: 'Platform', icon: <LayoutGrid size={ICON} />, options: platformOptions },
    { key: 'region', label: 'Region', icon: <Globe size={ICON} />, options: regionOptions },
    { key: 'language', label: 'Language', icon: <Languages size={ICON} />, options: languageOptions },
    { key: 'budget', label: 'Budget', icon: <Wallet size={ICON} />, options: budgetOptions },
    { key: 'available', label: 'Availability', icon: <CalendarCheck size={ICON} />, options: availabilityOptions },
    { key: 'rating', label: 'Performance', icon: <Star size={ICON} />, options: ratingOptions },
  ]
}

/** Categories browser: category, budget, region, availability, rating. */
export function categoryFilters(categories: MarketplaceCategory[]): HeroFilter[] {
  return [
    { key: 'category', label: 'Category', icon: <Boxes size={ICON} />, options: categoryOptions(categories) },
    { key: 'budget', label: 'Budget', icon: <Wallet size={ICON} />, options: budgetOptions },
    { key: 'rating', label: 'Experience', icon: <Star size={ICON} />, options: ratingOptions },
    { key: 'region', label: 'Location', icon: <Globe size={ICON} />, options: regionOptions },
    { key: 'available', label: 'Availability', icon: <CalendarCheck size={ICON} />, options: availabilityOptions },
  ]
}

/** Saved items: item type, category, location, tags, compare eligibility. */
export function savedFilters(categories: MarketplaceCategory[]): HeroFilter[] {
  return [
    {
      key: 'type', label: 'Item type', icon: <Boxes size={ICON} />,
      options: [
        { value: '', label: 'All types' },
        { value: 'supplier', label: 'Suppliers' },
        { value: 'creator', label: 'Creators' },
      ],
    },
    { key: 'category', label: 'Category', icon: <Briefcase size={ICON} />, options: categoryOptions(categories) },
    { key: 'region', label: 'Location', icon: <Globe size={ICON} />, options: regionOptions },
    { key: 'rating', label: 'Rating', icon: <Star size={ICON} />, options: ratingOptions },
    { key: 'available', label: 'Compare eligible', icon: <ShieldCheck size={ICON} />, options: availabilityOptions },
  ]
}

/** Requests: request type, category, budget, deadline window, status, supplier count. */
export function requestFilters(categories: MarketplaceCategory[]): HeroFilter[] {
  return [
    {
      key: 'type', label: 'Request type', icon: <FileText size={ICON} />,
      options: [
        { value: '', label: 'All types' },
        { value: 'discovery', label: 'Discovery' },
        { value: 'rfq', label: 'RFQ' },
      ],
    },
    { key: 'category', label: 'Category', icon: <Boxes size={ICON} />, options: categoryOptions(categories) },
    { key: 'budget', label: 'Budget range', icon: <Wallet size={ICON} />, options: budgetOptions },
    {
      key: 'status', label: 'Status', icon: <ShieldCheck size={ICON} />,
      options: options(
        (Object.entries(REQUEST_STATUS_META) as [string, { label: string }][])
          .map(([value, meta]) => [value, meta.label] as [string, string]),
        'All statuses',
      ),
    },
  ]
}

/** Orders: date range, order status, escrow status, delivery status, category. */
export function orderFilters(categories: MarketplaceCategory[]): HeroFilter[] {
  const orderStatuses: [string, string][] = [
    ['escrow_held', 'Escrow held'], ['in_progress', 'In progress'], ['delivered', 'Delivered'],
    ['completed', 'Completed'], ['disputed', 'Disputed'], ['refunded', 'Refunded'], ['cancelled', 'Cancelled'],
  ]
  return [
    {
      key: 'status', label: 'Order status', icon: <Receipt size={ICON} />,
      options: options(orderStatuses, 'All statuses'),
    },
    {
      key: 'escrow', label: 'Escrow status', icon: <ShieldCheck size={ICON} />,
      options: options(
        (Object.entries(ESCROW_META) as [string, { label: string }][]).map(([value, meta]) => [value, meta.label] as [string, string]),
        'All statuses',
      ),
    },
    {
      key: 'delivery', label: 'Delivery status', icon: <Truck size={ICON} />,
      options: options(
        (Object.entries(DELIVERY_META) as [string, { label: string }][]).map(([value, meta]) => [value, meta.label] as [string, string]),
        'All statuses',
      ),
    },
    { key: 'category', label: 'Category', icon: <Boxes size={ICON} />, options: categoryOptions(categories) },
  ]
}
