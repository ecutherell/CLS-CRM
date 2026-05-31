let sb = null;
let athletes = [];
let salesLog = [];
let activeFilter = 'active';
let addOpen = false;
let sortCol = 'name';
let sortDir = 1;
let modalId = null;
let myMeets = [];
let hotLeads = [];

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const AV = [
  'background:#dce8fa;color:#185fa5',
  'background:#d6edcb;color:#2e5c0a',
  'background:#fbe8d4;color:#7a3e00',
  'background:#f5d9e7;color:#8b1f55',
  'background:#e5e0f9;color:#4a3faa',
  'background:#d4f0e5;color:#0e5c43',
];
