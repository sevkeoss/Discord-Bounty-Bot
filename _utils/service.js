class Service {
  lister;
  hunter;
  service_number;
  service_id;
  channel; // null until service is accepted by initiator
  service_accepted = false;
  middlemen = [];

  constructor(lister, hunter, service_number, service_id) {
    this.lister = lister;
    this.hunter = hunter;
    this.service_number = service_number;
    this.service_id = service_id;
  }

  addMiddlePerson(id) {
    this.middlemen.push(id);
  }
  hasMiddlePerson(middlePersonId) {
    return this.middlemen.includes(middlePersonId);
  }
}

const active_services = new Map();

module.exports = {
  active_services,
  Service,
};
