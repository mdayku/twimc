const str = '[TODO: Incident description]'
console.log('String:', JSON.stringify(str))
console.log('includes [TODO]:', str.includes('[TODO]'))
console.log('includes [TODO:', str.includes('[TODO:'))
console.log('includes TODO:', str.includes('TODO'))
console.log('Length:', str.length)
console.log('Char codes:', [...str].map(c => c.charCodeAt(0)))

// Test the exact condition from the code
const condition = !str || str.trim() === '' || str.includes('[TODO]')
console.log('Full condition result:', condition)
