import { useNavigate } from "react-router";
import { useEffect } from "react";

export default function Page() {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate("/dashboard/chat");
  }, [navigate]);
  
  return null;
}
