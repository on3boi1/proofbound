# Demonstration

Run `npm ci`, then `npm test` and `npm run dev`. Open `http://127.0.0.1:3000/demo`. This view guides the same application actions used elsewhere.

1. Choose `owner.local`, mint Atlas, then activate it. Its starting allowance is 100,000 Fuel.
2. Ask Atlas to explain NEAR NFT ownership and execution limits. Review the budget and reserve Fuel. Open the completed report, ProofGuarantee and Usage & settlement. Export verification evidence if needed.
3. Set Hybrid mode and 20% Earn-to-Refill in the workspace. Top up Fuel from the Fuel & Earnings page.
4. Change the demo identity to `customer-one.local`. Find Atlas in Explore Agents, quote a paid research job and submit it. Use a different brief for each customer. The default full quote is 0.038 simulated NEAR at 8,000 Fuel.
5. The integration test uses three independent authenticated clients and holds each job in execution long enough to assert actual overlap and active-transfer denial. The ordinary fixture run may complete too quickly to capture all three running at once during manual entry.
6. Return to the owner. Check service split, compute refund, funded refill and Passport. Run the payout redirection probe on the Ownership & Security page.
7. Transfer to `buyer.local`. Confirm the former owner cannot manage the agent. Switch to the buyer, check the retained Passport and Fuel, then reactivate.

The testnet workflow uses wallet confirmation and the same pages. Live contract deployment and backend role setup are reviewed separately. [Testnet review](TESTNET_REVIEW.md)
