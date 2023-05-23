class Bounty {
  lister;
  hunter;
  amount;
  bounty_id;
  channel; // null until bounty is accepted by initiator
  hunter_accepted = false;
  middlemen = [];

  constructor(lister, hunter, amount, bounty_id) {
    this.lister = lister;
    this.hunter = hunter;
    this.amount = amount;
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
