const { differenceInDays, parseISO, format } = require('date-fns');

const d1 = new Date('2026-07-24');
const d2 = new Date('2026-07-26');
console.log('d1:', d1);
console.log('d2:', d2);
console.log('diff:', differenceInDays(d2, d1));

const d3 = parseISO('2026-07-24');
console.log('d3:', d3);
console.log('diff2:', differenceInDays(d2, d3));

const localDate = (str) => {
    const [y, m, d] = str.split('-');
    return new Date(y, m - 1, d);
}
console.log('local1:', localDate('2026-07-24'));
