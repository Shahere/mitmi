import { ContactInfo } from "./utils";

/**
 * This class represent a Contact
 */
class Contact {
  id: string;
  name: string;

  /**
   * Create a contact
   *
   * @param id - ID of the contact
   * @param name - Name of the contact
   */
  constructor(id: string, name: string) {
    this.name = name;
    this.id = id;
  }

  /**
   *
   * @returns The contact informations
   */
  toString(): ContactInfo {
    return {
      id: this.id,
      name: this.name,
    };
  }
}

export { Contact };
