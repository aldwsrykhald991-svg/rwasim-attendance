// Test server only: Riyadh is already April 11 while UTC is still April 10.
const NativeDate = globalThis.Date;
const now = NativeDate.parse('2030-04-10T21:30:00Z');
globalThis.Date = class extends NativeDate {
  constructor(...args) {
    if (args.length) super(...args);
    else super(now);
  }
  static now() { return now; }
};
