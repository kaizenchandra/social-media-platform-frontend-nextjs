"use client";
import { createContext, useContext } from "react";
import { defaultWellbeing } from "./contracts";
export const wellbeingContext = createContext(defaultWellbeing);
export const useWellbeing = () => useContext(wellbeingContext);
