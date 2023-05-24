class Bounty {
  lister;
  hunter;
  bounty_number;
  bounty_id;
  channel; // null until bounty is accepted by initiator
  hunter_accepted = false;
  middlemen = [];

  constructor(lister, hunter, bounty_number, bounty_id) {
    this.lister = lister;
    this.hunter = hunter;
    this.bounty_number = bounty_number;
    this.bounty_id = bounty_id;
  }

  addMiddlePerson(id) {
    this.middlemen.push(id);
  }
  hasMiddlePerson(middlePersonId) {
    return this.middlemen.includes(middlePersonId);
  }
}

const active_bounties = new Map();

module.exports = {
  active_bounties,
  Bounty,
};
