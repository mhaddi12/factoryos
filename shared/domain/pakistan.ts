const CITY_NAMES = [
  'Abbottabad',
  'Ahmadpur East',
  'Alipur',
  'Arifwala',
  'Attock',
  'Badin',
  'Bahawalnagar',
  'Bahawalpur',
  'Bannu',
  'Batkhela',
  'Bhakkar',
  'Bhalwal',
  'Bhimber',
  'Burewala',
  'Chakwal',
  'Chaman',
  'Charsadda',
  'Chichawatni',
  'Chiniot',
  'Chishtian',
  'Chitral',
  'Choa Saidan Shah',
  'Dadu',
  'Daska',
  'Dera Allah Yar',
  'Dera Ghazi Khan',
  'Dera Ismail Khan',
  'Dera Murad Jamali',
  'Depalpur',
  'Digri',
  'Faisalabad',
  'Fateh Jang',
  'Fort Abbas',
  'Ghotki',
  'Gilgit',
  'Gojra',
  'Gujar Khan',
  'Gujranwala',
  'Gujrat',
  'Gwadar',
  'Hafizabad',
  'Hangu',
  'Haripur',
  'Haroonabad',
  'Hasilpur',
  'Hassan Abdal',
  'Hub',
  'Hunza',
  'Hyderabad',
  'Islamabad',
  'Jacobabad',
  'Jampur',
  'Jaranwala',
  'Jatoi',
  'Jauharabad',
  'Jhang',
  'Jhelum',
  'Kamalia',
  'Kamoke',
  'Karachi',
  'Kasur',
  'Khairpur',
  'Khanewal',
  'Khanpur',
  'Kharian',
  'Khushab',
  'Khuzdar',
  'Kohat',
  'Kot Addu',
  'Kotli',
  'Kotri',
  'Lahore',
  'Lalamusa',
  'Larkana',
  'Layyah',
  'Liaquatpur',
  'Lodhran',
  'Loralai',
  'Mailsi',
  'Mandi Bahauddin',
  'Mansehra',
  'Mardan',
  'Matiari',
  'Mianwali',
  'Mingora',
  'Mirpur',
  'Mirpur Khas',
  'Mithi',
  'Moro',
  'Multan',
  'Muridke',
  'Murree',
  'Muzaffarabad',
  'Muzaffargarh',
  'Nankana Sahib',
  'Narowal',
  'Naushahro Feroze',
  'Nawabshah',
  'Nowshera',
  'Okara',
  'Pakpattan',
  'Pattoki',
  'Peshawar',
  'Pind Dadan Khan',
  'Quetta',
  'Rahim Yar Khan',
  'Rajanpur',
  'Rawalakot',
  'Rawalpindi',
  'Sadiqabad',
  'Sahiwal',
  'Saidpur',
  'Saidu Sharif',
  'Samundri',
  'Sanghar',
  'Sargodha',
  'Shahdadpur',
  'Shaheed Benazirabad',
  'Sheikhupura',
  'Shikarpur',
  'Sialkot',
  'Sibi',
  'Skardu',
  'Sukkur',
  'Swabi',
  'Talagang',
  'Tando Adam',
  'Tando Allahyar',
  'Tando Muhammad Khan',
  'Tank',
  'Taxila',
  'Thatta',
  'Timergara',
  'Toba Tek Singh',
  'Turbat',
  'Umerkot',
  'Vehari',
  'Wah Cantonment',
  'Wazirabad',
  'Zhob',
]

const CITY_ALIASES: Record<string, string> = {
  'd g khan': 'Dera Ghazi Khan',
  'dg khan': 'Dera Ghazi Khan',
  'd i khan': 'Dera Ismail Khan',
  'di khan': 'Dera Ismail Khan',
  'fsd': 'Faisalabad',
  'isb': 'Islamabad',
  'islamabad capital': 'Islamabad',
  'khi': 'Karachi',
  'lhr': 'Lahore',
  'nawab shah': 'Nawabshah',
  'pindi': 'Rawalpindi',
  'rahimyar khan': 'Rahim Yar Khan',
  'rwp': 'Rawalpindi',
  'sba': 'Shaheed Benazirabad',
}

export const PAKISTAN_CITIES = [...new Set(CITY_NAMES)].sort((left, right) => left.localeCompare(right))

const citiesByKey = new Map(PAKISTAN_CITIES.map(city => [cityKey(city), city]))

function cityKey(value: string) {
  return value.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').replace(/ city$/, '')
}

export function canonicalCity(value: string) {
  const key = cityKey(value)
  return CITY_ALIASES[key] ?? citiesByKey.get(key) ?? null
}

function localPhoneDigits(value: string) {
  let digits = value.replace(/\D/g, '')

  if (digits.startsWith('0092')) {
    digits = `0${digits.slice(4)}`
  } else if (digits.startsWith('92') && digits.length >= 12) {
    digits = `0${digits.slice(2)}`
  }

  return digits
}

export function canonicalPhone(value: string) {
  const digits = localPhoneDigits(value)

  if (/^03\d{9}$/.test(digits)) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`
  }

  if (/^111\d{6}$/.test(digits)) {
    return `111-${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  if (/^0[1-9]\d{8,10}$/.test(digits) && !digits.startsWith('03')) {
    return digits
  }

  return null
}

export function canonicalTaxNumber(value: string) {
  const digits = value.replace(/\D/g, '')

  if (!/^\d+$/.test(digits) || /^0+$/.test(digits)) {
    return null
  }

  if (digits.length === 7) {
    return digits
  }

  if (digits.length === 8) {
    return `${digits.slice(0, 7)}-${digits.slice(7)}`
  }

  if (digits.length === 13) {
    if ('1234567'.includes(digits[0]!)) {
      return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
    }

    return digits
  }

  return null
}

export function canonicalPersonName(value: string) {
  const name = value.trim().replace(/\s+/g, ' ')

  if (name.length < 2 || name.length > 120 || !/^[A-Za-z][A-Za-z .'-]*$/.test(name)) {
    return null
  }

  return name
}

export function canonicalBusinessName(value: string, max = 160) {
  const name = value.trim().replace(/\s+/g, ' ')

  if (name.length < 2 || name.length > max || !/[A-Za-z]/.test(name) || !/^[A-Za-z0-9][A-Za-z0-9 .,&'()-]*$/.test(name)) {
    return null
  }

  return name
}

export function canonicalAddress(value: string) {
  const address = value.trim().replace(/\s+/g, ' ')

  if (address.length < 5 || address.length > 300 || !/[A-Za-z0-9]/.test(address)) {
    return null
  }

  return address
}
