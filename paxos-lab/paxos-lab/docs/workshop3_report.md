# Part 1: Understanding Consensus

**Terminal Result:**

```
> paxos-lab@1.0.0 happy
> node scenarios/happy_path.js


====================
SCENARIO: HAPPY PATH
====================

====================
Proposal Value = instances=10
====================
Acceptors: 3
Required Quorum: 2

A1 PROMISE
A2 PROMISE
A3 PROMISE
Promises Received: 3/3
A1 ACCEPTED
A2 ACCEPTED
A3 ACCEPTED
Acceptances Received: 3/3
VALUE CHOSEN: instances=10
L1 LEARNED CHOSEN VALUE: instances=10
```

**Observation:**

The chosen value was `instances=10` with a required quorum size of 2. Consensus was successfully reached because all 3 acceptors issued Promise and Accept messages, successfully exceeding the required majority.

**Reflection Questions:**

* **Which role initiated the consensus round?** The Proposer initiated the consensus round.
* **At what point was the value considered chosen?** The value was considered chosen when acceptances reached the majority quorum (3/3).
* **What role did the acceptors play?** Acceptors issued promises, accepted proposals, and collectively formed a majority.
* **What role did the learners play?** Learners passively learned the final agreed value without participating in voting.
* **Why was a majority required?** A majority ensures agreement consistency while allowing the system to tolerate minority node failures.

# Part 2: Acceptor Failure

**Terminal Result:**

```
> paxos-lab@1.0.0 failure
> node scenarios/acceptor_failure.js


====================
SCENARIO: ACCEPTOR FAILURE
====================

A3 has failed.

====================
Proposal Value = instances=10
====================
Acceptors: 3
Required Quorum: 2

A1 PROMISE
A2 PROMISE
A3 OFFLINE
Promises Received: 2/3
A1 ACCEPTED
A2 ACCEPTED
A3 OFFLINE
Acceptances Received: 2/3
VALUE CHOSEN: instances=10
L1 LEARNED CHOSEN VALUE: instances=10
```

**Observation:**

Acceptor A3 failed and went offline, but the chosen value remained `instances=10`. Consensus still succeeded because the remaining 2/3 acceptors responded, perfectly meeting the required quorum of 2.

**Reflection Questions:**

* **Why did consensus continue despite a failure?** Decisions depend on a majority quorum, not unanimous agreement.
* **How many acceptors can fail in this deployment?** A maximum of 1 acceptor can fail in this 3-node deployment.
* **What assumption is Paxos making?** Paxos assumes that a majority of the nodes will remain online and capable of communication.
* **Would consensus still succeed if another acceptor failed?** No, the remaining 1 node would fail to meet the quorum of 2, halting consensus.

# Part 3: Competing Proposers

**Terminal Result:**

```
> paxos-lab@1.0.0 proposers
> node scenarios/competing_proposers.js


P1 -> Prepare(101)

P2 -> Prepare(102)

P1 -> Accept(101)
A1 REJECTED proposal 101
A1 REJECTED
A2 REJECTED proposal 101
A2 REJECTED
A3 REJECTED proposal 101
A3 REJECTED

P2 -> Accept(102)
A1 ACCEPTED
A2 ACCEPTED
A3 ACCEPTED
```

**Observation:**

Proposer P2 succeeded with the winning proposal number 102. Proposer P1 was rejected because its proposal number (101) was lower, and the acceptors had already promised to ignore anything lower than 102.

**Reflection Questions:**

* **Why does the higher proposal number win?** It establishes a strict chronological order to resolve conflicts between competing proposers.
* **Why are proposal numbers necessary?** They prevent infinite loops of competing votes and resolve split-brain scenarios.
* **Does a higher proposal number imply a better decision?** No. It just grants that proposer the right to continue coordinating the round.
* **What would happen if proposal numbers did not exist?** Competing proposers would continuously overwrite each other, permanently stalling the protocol.

# Part 4: Partial Acceptance

**Terminal Result:**

```
> paxos-lab@1.0.0 partial
> node scenarios/partial_acceptance.js


====================
SCENARIO: PARTIAL ACCEPTANCE
====================

A1 reports:
(101, instances=10)

P2 wants:
instances=20

====================
Proposal Value = instances=20
====================
Acceptors: 3
Required Quorum: 2

A2 PROMISE
A3 PROMISE
Promises Received: 2/3
A1 ACCEPTED
A2 ACCEPTED
A3 ACCEPTED
Acceptances Received: 3/3
VALUE CHOSEN: instances=20
L1 LEARNED CHOSEN VALUE: instances=20
```

**Observation:**

A1 reported a partially accepted value `(101, instances=10)`, but P2 proposed and successfully chose `instances=20`. The value changed because the previous value never reached a majority, freeing P2 to push its own value.

**Reflection Questions:**

* **Why was the second proposer forced to adopt the earlier value?** P2 was actually not forced to adopt it here because the earlier value never reached a majority quorum.
* **What information must acceptors remember?** They must remember the highest proposal number promised and any previously accepted value.
* **What would happen if acceptors forgot their history?** They might accept conflicting values, destroying system consistency.
* **How does this preserve safety?** It ensures that once a value achieves a majority, any new overlapping quorum will force new proposers to adopt it.

# Part 5: Preserving Chosen Values

**Terminal Result:**

```
> paxos-lab@1.0.0 preserve
> node scenarios/preserve_chosen_value.js


====================
SCENARIO: PRESERVING A CHOSEN VALUE
====================

Previously chosen value:
(90, instances=12)

New proposer wants:
instances=20

====================
Proposal Value = instances=20
====================
Acceptors: 3
Required Quorum: 2

A1 reports previously accepted:
(90, instances=12)
A1 PROMISE
A2 reports previously accepted:
(90, instances=12)
A2 PROMISE
A3 reports previously accepted:
(90, instances=12)
A3 PROMISE
Promises Received: 3/3

PREVIOUSLY ACCEPTED VALUE FOUND
Proposal 90
Value = instances=12
Overriding proposer value to preserve safety
A1 ACCEPTED
A2 ACCEPTED
A3 ACCEPTED
Acceptances Received: 3/3
VALUE CHOSEN: instances=12
L1 LEARNED CHOSEN VALUE: instances=12
```

**Observation:**

The previously chosen value was `(90, instances=12)`, and the new proposer wanted `instances=20`. The final chosen value remained `instances=12` because the new proposer found the previously accepted value during the Promise phase and safely overwrote its own proposal.

**Reflection Questions:**

* **Why can future proposers not overwrite previously chosen values?** Because a chosen value is a finalized system decision; changing it violates distributed consistency.
* **What role does quorum overlap play?** It guarantees that any new majority will contain at least one acceptor that remembers the previously chosen value.
* **Which Paxos safety property is being preserved?** The safety property that only a single value can ever be chosen.
* **What would happen if previously chosen values could be replaced?** The system would lose consensus, and different nodes would hold conflicting decisions.

# Part 6: Multi-Paxos and Stable Proposers

**Terminal Result:**

```
> paxos-lab@1.0.0 multi
> node scenarios/multi_paxos.js


====================
SCENARIO: MULTI-PAXOS
====================

Round 1

====================
Proposal Value = instances=10
====================
Acceptors: 3
Required Quorum: 2

A1 PROMISE
A2 PROMISE
A3 PROMISE
Promises Received: 3/3
A1 ACCEPTED
A2 ACCEPTED
A3 ACCEPTED
Acceptances Received: 3/3
VALUE CHOSEN: instances=10
L1 LEARNED CHOSEN VALUE: instances=10

Round 2

====================
Proposal Value = instances=20
====================
Acceptors: 3
Required Quorum: 2

A1 reports previously accepted:
(101, instances=10)
A1 PROMISE
A2 reports previously accepted:
(101, instances=10)
A2 PROMISE
A3 reports previously accepted:
(101, instances=10)
A3 PROMISE
Promises Received: 3/3

PREVIOUSLY ACCEPTED VALUE FOUND
Proposal 101
Value = instances=10
Overriding proposer value to preserve safety
A1 ACCEPTED
A2 ACCEPTED
A3 ACCEPTED
Acceptances Received: 3/3
VALUE CHOSEN: instances=10
L1 LEARNED CHOSEN VALUE: instances=10

Round 3

====================
Proposal Value = instances=30
====================
Acceptors: 3
Required Quorum: 2

A1 reports previously accepted:
(102, instances=10)
A1 PROMISE
A2 reports previously accepted:
(102, instances=10)
A2 PROMISE
A3 reports previously accepted:
(102, instances=10)
A3 PROMISE
Promises Received: 3/3

PREVIOUSLY ACCEPTED VALUE FOUND
Proposal 102
Value = instances=10
Overriding proposer value to preserve safety
A1 ACCEPTED
A2 ACCEPTED
A3 ACCEPTED
Acceptances Received: 3/3
VALUE CHOSEN: instances=10
L1 LEARNED CHOSEN VALUE: instances=10

Round 4

====================
Proposal Value = instances=40
====================
Acceptors: 3
Required Quorum: 2

A1 reports previously accepted:
(103, instances=10)
A1 PROMISE
A2 reports previously accepted:
(103, instances=10)
A2 PROMISE
A3 reports previously accepted:
(103, instances=10)
A3 PROMISE
Promises Received: 3/3

PREVIOUSLY ACCEPTED VALUE FOUND
Proposal 103
Value = instances=10
Overriding proposer value to preserve safety
A1 ACCEPTED
A2 ACCEPTED
A3 ACCEPTED
Acceptances Received: 3/3
VALUE CHOSEN: instances=10
L1 LEARNED CHOSEN VALUE: instances=10

Observation:
P1 successfully coordinated every round.
Proposal numbers increased:
101 -> 102 -> 103 -> 104

In Basic Paxos, leaders are not elected.
Because P1 repeatedly succeeds,
the system naturally converges on P1 as a stable proposer.

This behaviour is the intuition behind Multi-Paxos.
```

**Observation:**

Proposer P1 successfully coordinated four consecutive rounds (101 to 104) without competition. By avoiding competing proposers, P1 naturally emerged as a stable leader.

**Reflection Questions:**

* **Does Paxos explicitly elect a leader?** No, a leader emerges naturally when one proposer repeatedly succeeds without interruption.
* **Why does one proposer eventually dominate?** It continues using increasing proposal numbers while no other proposer interrupts the process.
* **How does this improve efficiency?** It allows the stable proposer to coordinate repeated consensus rounds without contention.
* **What problem does Multi-Paxos address?** It addresses the inefficiency caused by multiple proposers constantly competing in basic Paxos.

# Part 7: Breaking Paxos Assumptions

## Part 7.1: Network Partitioning

**Terminal Result:**

```
> paxos-lab@1.0.0 partition
> node scenarios/network_partition.js


====================
SCENARIO: NETWORK PARTITION
====================
NETWORK DELIVERED: Prepare(101)
NETWORK PARTITION ACTIVE
NETWORK DROPPED: Prepare(102)
NETWORK DROPPED: Accept(102, instances=10)
NETWORK PARTITION REPAIRED
NETWORK DELIVERED: Prepare(103)
```

**Observation:**

A network partition caused `Prepare(102)` and `Accept(102)` messages to be dropped, stalling the system. Progress could only resume once the partition was repaired and a new proposal was delivered.

**Reflection Questions:**

* **Which protocol property is most affected?** Liveness (progress) is most affected because the system cannot reach a decision without communication.
* **Does a partition necessarily violate safety?** No. Safety is maintained because no conflicting values are chosen during the stall.
* **Does a partition prevent progress?** Yes. It prevents the formation of a majority quorum, temporarily halting consensus.
* **Why does Paxos prefer consistency over availability?** Paxos is designed to guarantee that once a decision is made it is never violated, even if it means halting the system during network failures.

## Part 7.2: Majority Loss

**Terminal Result:**

```
> paxos-lab@1.0.0 majority-loss
> node scenarios/breaking_assumptions/majority_loss.js


====================
SCENARIO: LOSS OF MAJORITY
====================

====================
Proposal Value = instances=10
====================
Acceptors: 3
Required Quorum: 2

A1 PROMISE
A2 OFFLINE
A3 OFFLINE
Promises Received: 1/3
FAILED: no quorum of promises
```

**Observation:**

Two acceptors went offline, leaving only one available node. The protocol immediately stopped with a failure because 1/3 acceptors cannot meet the required majority quorum of 2.

**Reflection Questions:**

* **Which requirement is no longer satisfied?** The requirement for quorum availability is no longer satisfied.
* **Why can Paxos no longer proceed?** It cannot form a majority to securely promise or accept new proposals.
* **Is safety violated?** No, safety is preserved because the system stops rather than writing bad data.
* **Is liveness violated?** Yes, liveness is violated because the system is completely unable to make progress.

## Part 7.3: State Loss

**Terminal Result:**

```
> paxos-lab@1.0.0 state-loss
> node scenarios/breaking_assumptions/state_loss.js


====================
SCENARIO: STATE LOSS
====================

Before Loss:
Acceptor {
  id: 'A1',
  highestPromised: 101,
  acceptedProposal: { number: 101, value: 'instances=10' },
  online: true
}

After Loss:
Acceptor {
  id: 'A1',
  highestPromised: 0,
  acceptedProposal: null,
  online: true
}

WARNING:
Acceptor forgot previous history.
Paxos safety assumption violated.
```

**Observation:**

Acceptor A1 suffered a state loss, causing its `highestPromised` value to reset to 0. This is extremely dangerous because the "amnesiac" acceptor might accidentally vote for a conflicting proposal it had previously rejected.

**Reflection Questions:**

* **What information must acceptors remember?** They must securely remember their highest promised number and any previously accepted proposal.
* **Why is persistent storage important?** It ensures nodes retain their history across crashes, which is strictly required to enforce safety.
* **What could happen if multiple acceptors forget history?** The system could overwrite previously chosen values, completely destroying data consistency.
* **Which Paxos assumption has been violated?** The fundamental assumption that protocol state is reliably and durably persisted.

## Part 7.4: Quorum Misconfiguration

**Terminal Result:**

```
> paxos-lab@1.0.0 quorum-error
> node scenarios/breaking_assumptions/quorum_misconfiguration.js


====================
SCENARIO: QUORUM MISCONFIGURATION
====================

Correct Majority:
3

Modified Majority:
2

Possible Quorums:
Value A => A1 A2
Value B => A4 A5

WARNING:
Quorum intersection removed.
Different values could be chosen.
```

**Observation:**

The majority requirement was incorrectly lowered, which successfully removed quorum intersection. This is very unsafe because it allows disjoint subsets of nodes to form separate quorums independently.

**Reflection Questions:**

* **What property has been lost?** The mathematical guarantee of quorum overlap has been completely lost.
* **Why are overlapping quorums important?** Overlapping quorums ensure that any new quorum shares at least one node with a previous quorum, forcing the preservation of history.
* **Could two conflicting values be chosen?** Yes, disjoint quorums allow the system to split and finalize conflicting values simultaneously.
* **What lesson does this teach about protocol configuration?** Quorum mathematics are security-critical, and parameters must be strictly validated to protect system safety.

# Part 8: Hardening a Paxos Deployment

