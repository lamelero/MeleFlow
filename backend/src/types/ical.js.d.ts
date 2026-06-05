declare module "ical.js" {
  export class Component {
    constructor(jCal: unknown[]);
    getAllSubcomponents(name: string): Component[];
    getFirstPropertyValue(name: string): unknown;
  }

  export class Time {
    toJSDate(): Date;
  }

  export class Recur {}

  export function parse(input: string): unknown[];
}
