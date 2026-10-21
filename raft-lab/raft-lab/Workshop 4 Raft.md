# Workshop 4 Raft

## Part1 Establishing Authority

![image-20261021140156915](C:\Users\ziyus\AppData\Roaming\Typora\typora-user-images\image-20261021140156915.png)

The follower B has been the candidate,  it sent request to other followers for vote. A and C have accepted the request and voted for B. B get 3 votes then be elected. The term number is 1.

In raft, the system need a leader to send requests to followers to complete processing. So it's necessary to elect a leader before processing requests.

A majority is required because if some of the followers lost connect, they cannot elect a leader and the other part can still work. For example, A is the leader and BCDE are the followers. if B and C are lose connection and B or C cannot be a new leader. Meanwhile ADE can still work normally and waiting for B and C reconnect.

The raft using random timeout to avoid two or more followers being candidates at the same time. Nevertheless, being elected as a leader  need a majority and a follower can just vote one candidate, so there will be only one candidate can be the leader.

Term is playing a role as clock or flag in election process. While the old leader is disconnected, the system elects a new leader. And when the old leader reconnect, it realized that its term is less that others' term, so it becomes a follower automatically.

## Part 2 Maintaining Leadership

![image-20261021144953555](C:\Users\ziyus\AppData\Roaming\Typora\typora-user-images\image-20261021144953555.png)

The heartbeats are the symbols to show the leader is still alive and active, while the followers didn't receive the heartbeats until timeout, the election process will start.

The replication and heartbeats both need to contain the term, log and commit process, using AppendEntries can make the system less complex and easy to understand.

If the heartbeats stopped, the followers will regard the leader as disconnected, the first follower who is timeout will start the election process.

If the followers receive any AppendEntries from the leader, they reset their election timers as they ensure the leader is alive and working well.

## Part 3

![image-20261021145718282](C:\Users\ziyus\AppData\Roaming\Typora\typora-user-images\image-20261021145718282.png)

'' 

In this example, B is offline and the other followers cannot receive heartbeats from it, the election timer will not be reset. While A's timer is timeout, it begins a election section and become the new leader.

A new term is created because the system want to ensure when B reconnected, it can find out itself is no longer a leader and then becomes a follower automaticaly.

Because the old leader is offline, it cannot send heartbeats anymore.

At one time only one follower can start a election and it must get a majority to become the new leader. So even if there are more than one follower start the election, only one of them can be the leader.

## Part 4

![image-20261021150727916](C:\Users\ziyus\AppData\Roaming\Typora\typora-user-images\image-20261021150727916.png)



The client request is instance = 10.

In raft system, only the leader receives the request from the client and then sends AppendEntries to all followers. Expect for the instances, the terms and process will also be sent at the same time. After a majority is accepted ,the leader will push the process and commit this request. A majority acknowledgement is required because in this way the leader knows that this system is working normally. while there won't be conflicts between majority and the others. If they don't need a majority, the followers that are disconnected from the majority may elect a new leader and make their decisions.

## Part 5

![image-20261021151529265](C:\Users\ziyus\AppData\Roaming\Typora\typora-user-images\image-20261021151529265.png)

Follower C is offline and only A,B is alive. As A received 2 votes, from A and B respectively, is a majority. So the entries are still committed.

Although C is offline, the left follower can still form a majority, so the system can work normarlly.

Node B is essential, its response pushing the progress.

Raft using Quorums to tolerate planned failures.

## Part 6

![image-20261021152024210](C:\Users\ziyus\AppData\Roaming\Typora\typora-user-images\image-20261021152024210.png)



There are 5 nodes in this system, and 3 of them are offline. Only 2 alive node cannot form a majority. So no election and no committed.

As the system cannot elect a leader, there's no one can accept the requirement from the client. And due to no majority, the election and commit will be both failed. This mechanism protects the consistency.

## Part 7

![image-20261021152433520](C:\Users\ziyus\AppData\Roaming\Typora\typora-user-images\image-20261021152433520.png)

The heartbeats are working before the partition, while the very next heartbeats are dropped and  AppendEntries that contains a instances = 10 is dropped. All the dropped messages contain majority.

Raft prevents conflicting histories by requiring majority at all times to make most nodes have the same log. While other nodes try to update their logs when they find they are out of order. split-brain is dangerous as it will cause conflict in the system. Raft refuse work during the partition to protect consistency.

## Part 8

![image-20261021153341828](C:\Users\ziyus\AppData\Roaming\Typora\typora-user-images\image-20261021153341828.png)

The follower is 2 logs behind the leader, it recover its log using the leader's log.

The followers trust the leader as the leader won't miss any log, otherwise the election process will start and a new leader will be elected. By using the log consistency, this system can promise that the leader and the follower have the same log at the same time. In this way, even if  the leader is offline, the newly elected leader will also have correct logs so the consistency can be protected.

## Part 9

![image-20261021154951056](C:\Users\ziyus\AppData\Roaming\Typora\typora-user-images\image-20261021154951056.png)

Election storms will happen when the election timeout is so short, in this way, once the node didn't receive the heartbeats, they timeout in a very short time and then start election. However, another node timeout as well and then start another election... This frequently change is leadership churn. Slow followers a problem because they may deal with the messages slow and miss the heartbeats.

We can assume that the leader node may produce the information slow due to CPU limits and the AppendEntries may transport slow due to network problems.

## Part 10

I added leadership churn monitor and mitigation, which will detect frequently change of leader and then double the timeout if churn happened.  I also detect the time consumption of nodes, if the nodes consume too many time, it will be marked as slow node, while it's time out, no new logs and ACK will be sent to it. I also added a mitigation for network partition, if majority is offline, the leader will refuse to do anything and after partition, it will need to pass the check and then re-election.