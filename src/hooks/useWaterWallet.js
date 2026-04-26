import { useState, useCallback } from "react";
import {
  fetchSocietyBaseline,
  fetchCatchmentData,
  simulateROI,
  downloadReport,
} from "../api/waterwallet";

/**
 * useWaterWallet
 *
 * Central hook that manages API calls and loading/error state for all
 * three WaterWallet engines. Views can destructure only what they need.
 *
 * @returns {{
 *   societyData, catchmentData, roiData,
 *   loading, error,
 *   runSocietyBaseline, runCatchmentCalc, runROISimulation, runDownloadReport
 * }}
 */
export function useWaterWallet() {
  const [societyData, setSocietyData]   = useState(null);
  const [catchmentData, setCatchmentData] = useState(null);
  const [roiData, setRoiData]           = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  const withLoading = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      const msg = err?.response?.data?.detail ?? err.message ?? "Unknown error";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const runSocietyBaseline = useCallback(
    (payload) => withLoading(async () => {
      const data = await fetchSocietyBaseline(payload);
      setSocietyData(data);
      return data;
    }),
    [withLoading]
  );

  const runCatchmentCalc = useCallback(
    (payload) => withLoading(async () => {
      const data = await fetchCatchmentData(payload);
      setCatchmentData(data);
      return data;
    }),
    [withLoading]
  );

  const runROISimulation = useCallback(
    (payload) => withLoading(async () => {
      const data = await simulateROI(payload);
      setRoiData(data);
      return data;
    }),
    [withLoading]
  );

  const runDownloadReport = useCallback(
    (payload) => withLoading(() => downloadReport(payload)),
    [withLoading]
  );

  return {
    societyData,
    catchmentData,
    roiData,
    loading,
    error,
    runSocietyBaseline,
    runCatchmentCalc,
    runROISimulation,
    runDownloadReport,
  };
}
