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

function App() {
    






  return (
    <Router>
      <div style={{ paddingBottom: "10px" }}>
        <TabBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Play />} />
          <Route path="/minimaos" element={<MinimaOS />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/tasks" element={<Tasks />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
