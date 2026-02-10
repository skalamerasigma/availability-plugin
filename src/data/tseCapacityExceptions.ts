// TSE Chat Capacity Exceptions
// TSEs with custom conversation assignment limits (different from the default of 5)

export const TSE_CAPACITY_EXCEPTIONS: Record<string, number> = {
  'Abhijeet Lal': 5,
  'Ankita Dalvi': 5,
  'Arley Schenker': 5,
  'Betty Liu': 5,
  'Bhavana Prasad Kote': 5,
  'David Zingher': 1,
  'Erez Yagil': 5,
  'Erin Liu': 5,
  'Grania M': 5,
  'Hayden Greif-Neill': 5,
  'Hem Kamdar': 5,
  'J': 5,
  'Julia Lusala': 5,
  'Kabilan Thayaparan': 5,
  'Krish Pawooskar': 5,
  'Lyle Pierson Stachecki': 5,
  'Nathan Simpson': 5,
  'Nick Clancey': 5,
  'Nikhil Krishnappa': 5,
  'Nikita Bangale': 5,
  'Payton Steiner': 5,
  'Prerit Sachdeva': 5,
  'Priyanshi Singh': 5,
  'Rashi Madnani': 5,
  'Ratna Shivakumar': 5,
  'Roshini Padmanabha': 5,
  'Ryan Jaipersaud': 5,
  'Sagarika Sardesai': 5,
  'Sahibeer Singh': 4,
  'Salman Filli': 5,
  'Sanyam Khurana': 5,
  'Siddhi Jadhav': 5,
  'Soheli Das': 5,
  'Somachi Ngoka': 2,
  'Swapnil Deshpande': 5,
  'Vruddhi Kapre': 1,
  'Xyla Fang': 5,
}

// Default capacity for TSEs not in the exceptions list
export const DEFAULT_TSE_CAPACITY = 5

/**
 * Get the capacity limit for a TSE by name
 * Returns the exception limit if found, otherwise returns the default
 */
export function getTSECapacity(tseName: string): number {
  // Try exact match first
  if (TSE_CAPACITY_EXCEPTIONS[tseName]) {
    return TSE_CAPACITY_EXCEPTIONS[tseName]
  }
  
  // Try case-insensitive match
  const nameLower = tseName.toLowerCase()
  for (const [key, value] of Object.entries(TSE_CAPACITY_EXCEPTIONS)) {
    if (key.toLowerCase() === nameLower) {
      return value
    }
  }
  
  // Try first name match (for cases where full name might not match exactly)
  const firstName = tseName.split(' ')[0]
  for (const [key, value] of Object.entries(TSE_CAPACITY_EXCEPTIONS)) {
    if (key.toLowerCase().startsWith(firstName.toLowerCase() + ' ') || 
        key.toLowerCase() === firstName.toLowerCase()) {
      return value
    }
  }
  
  return DEFAULT_TSE_CAPACITY
}
