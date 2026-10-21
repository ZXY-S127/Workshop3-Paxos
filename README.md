# Workshop 3

**See Detailed Report of Workshop 3 in:**

`paxos-lab\paxos-lab\docs\workshop3_report.md`

**Completion list:**

| Part | Content | Command |
| --- | --- | --- |
| 1 | Understanding Consensus: Happy Path | `npm run happy` |
| 2 | Acceptor Failure | `npm run failure` |
| 3 | Competing Proposers | `npm run proposers` |
| 4 | Partial Acceptance | `npm run partial` |
| 5 | Preserving Chosen Values | `npm run preserve` |
| 6 | Multi-Paxos Stable Proposer | `npm run multi` |
| 7.1 | Network Partitioning | `npm run partition` |
| 7.2 | Majority Loss | `npm run majority-loss` |
| 7.3 | State Loss | `npm run state-loss` |
| 7.4 | Quorum Misconfiguration | `npm run quorum-error` |
| 8 | Hardening a Paxos Deployment | `npm run hardening` |

Run all at once: `npm run all`.

**Part 8 Detail:**

* Modified file: `scenarios/hardening.js`.
* Core modules required/used by this script: `proposer.js`, `acceptor.js`, `learner.js`, `quorum.js`.
* Five hardenings implemented: Quorum validation, State loss detection, Majority health check, Proposer churn detection, and Audit logs.


