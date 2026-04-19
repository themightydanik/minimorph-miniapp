import { useEffect, useState } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "./components/firebase";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import Play from "./components/Play";
import MinimaOS from "./components/MinimaOS";
import Friends from "./components/Friends";
import Tasks from "./components/Tasks";
import TabBar from "./components/TabBar";
import Missions from './components/Missions';

function App() {

  return (
    <Router>
      <div style={{ paddingBottom: "10px" }}>
        <TabBar />
<Routes>
  <Route path="/" element={<Planet />} />        // ✅ Новий
  <Route path="/missions" element={<Missions />} />  // ✅ Новий
  <Route path="/colony" element={<Colony />} />      // ✅ Новий
  <Route path="/locations" element={<Locations />} />// ✅ Новий
  <Route path="/friends" element={<Friends />} />    // Залишити
  <Route path="/missions" element={<Missions />} />
</Routes>
      </div>
    </Router>
  );
}

export default App;
