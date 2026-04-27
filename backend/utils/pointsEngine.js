/**
 * Calculates impact points based on the urgency of the task.
 * @param {string} urgency - 'Critical', 'High', 'Medium', 'Low'
 * @returns {number} The points to be awarded.
 */
const calculateImpactPoints = (urgency) => {
  switch (urgency) {
    case 'Critical': return 50;
    case 'High': return 30;
    case 'Medium': return 20;
    case 'Low': return 10;
    default: return 0;
  }
};

module.exports = { calculateImpactPoints };
