import { useEffect, useState } from "react";
import { db } from "./firebase";
import { saveUserData, loadUserData } from "./firebaseUser";
import { collection, doc, getDoc, getDocs, updateDoc, setDoc, query, where } from "firebase/firestore";

function Friends() {
  const [referrals, setReferrals] = useState([]);
  const [totalReferralPoints, setTotalReferralPoints] = useState(0);
  const [referralCount, setReferralCount] = useState(0);
  const [referralLink, setReferralLink] = useState("");

  const tg = window.Telegram?.WebApp;    
  const user = tg?.initDataUnsafe?.user;
  const botUsername = "MinimorphBot";
//  const [telegramId, settelegramId] = useState("demo");
const telegramId = user?.id?.toString() ?? "demo";

useEffect(() => {
  if (!user) return;

  // Формируем реферальную ссылку
  setReferralLink("https://t.me/" + botUsername + "?startapp=ref_" + user.id);

  const loadReferrals = async () => {
    try {
      const userRef = doc(db, "users", user.id.toString());
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) return;

      const userData = userSnap.data();
      const earnedMap = userData.earned || {};
      const allIds = Object.keys(earnedMap);

      let totalPoints = 0;
      const refs = [];

      for (const id of allIds) {
        const refUserSnap = await getDoc(doc(db, "users", id));
        const refUserData = refUserSnap.exists() ? refUserSnap.data() : {};

        refs.push({
          id,
          username: refUserData.username ?? null,
          earned: Number(earnedMap[id]) || 0,
        });

        totalPoints += Number(earnedMap[id]) || 0;
      }

      setReferrals(refs);
      setReferralCount(refs.length);
      setTotalReferralPoints(totalPoints);
    } catch (err) {
      console.error("Error loading referrals:", err);
    }
  };

  loadReferrals();
}, [user]);


  return (
      
    <div style={{boxSizing: "border-box", padding: "0px 20px 0px 20px", paddingTop: "5%",
  backgroundImage: `url('/ref-screen_bg1-min.jpg')`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  minHeight: '100vh',}}>
          <h2 style={{color: "#fff", backdropFilter:"blur(5px)", border: "1px solid #f8d06b", borderRadius: "10px", textAlign: "center", paddingTop: "1%", paddingBottom: "1%", marginTop: "8%",}}>Invite Friends <br/>and Get Rewards 🎁</h2>
      <p style={{color: "#fff", textAlign: "center",}}>🪙 Earn  10,000 points <br/>from each friend!</p>

      <div style={{ margin: "20px 0", color: "#fff", textAlign: "center",}}>
        <strong>Referral Link:</strong><br />
        <code>{referralLink}</code> <br />
          <button
  onClick={() => {
    navigator.clipboard.writeText(referralLink);
    alert("Referral link copied!");
  }}
  style={{
    marginTop: "10px",
    padding: "8px 16px",
    backgroundColor: "#ffa800",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
  }}
>
  📋 Copy Link
</button>
      </div>

      <div style={{ marginBottom: "10px", color: "#fff", textAlign: "center",}}>
        <h3 style={{ maxWidth: "80%", backdropFilter: "blur(5px)", background: "#00000078", borderRadius: "10px", border: "1px solid #ffffff99", margin: "0 auto",}}>🕺 Invited Friends: {referralCount}</h3>
      </div>

      <div style={{ marginBottom: "20px", color: "#fff", textAlign: "center",}}>
        <h3>💰 Earned from Referrals:<br /> {totalReferralPoints} Points</h3>
      </div>

      <p style={{color: "#fff", background: "#052a47", borderLeft: "3px solid #f8d06b", borderRadius: "7px", textAlign: "left", paddingTop: "1%", paddingBottom: "1%", paddingLeft: "5%", paddingRight: "1%",}}>
The number of friends will matter for receiving the Airdrop at the end of the season</p>


      <div style={{
        maxHeight: "250px",
        overflowY: "auto",
        border: "1px solid #aaa",
        padding: "10px",
        borderRadius: "8px",
        background: "#102030",
        color: "#fff",
      }}>
{referrals.length === 0 ? (
  <div>No invited friends yet.</div>
) : (
  <>
    {referrals.map((r, idx) => (
      <div key={idx} style={{ marginBottom: "10px" }}>
        {idx + 1}. {r.username ? `@${r.username}` : `User ${r.id.slice(-4)}`}
 — Earned:{" "}
        {Number.isFinite(r.earned) ? r.earned : 0}
      </div>
    ))}
  </>
)}


      </div>
    </div>
  );
}

export default Friends;
