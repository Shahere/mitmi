import { ContactInfo } from "./utils";

class Contact {
  id: string;
  name: string;

  constructor(id: string, name: string) {
    this.name = name;
    this.id = id;
  }

  toString(): ContactInfo {
    return {
      id: this.id,
      name: this.name,
    };
  }
}

export { Contact };
