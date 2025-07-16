import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useGame } from "../../contexts/GameContext";
import { UserService } from "../../services/database/userService";

const userService = new UserService(supabase);

function RegisterModalBody({ onClose }: { onClose: () => void }) {
  const [errorText, setErrorText] = useState('');
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [code, setCode] = useState("");
  const [managerName, setManagerName] = useState("");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [teamName, setTeamName] = useState("");
  const [step, setStep] = useState(0);

  const { user } = useAuth();
  const { refreshGameState } = useGame();

  useEffect(() => {
    setErrorText('');
    setManagerName('');
    setName('');
    setSurname('');
    setTeamName('');
    setEmail('');
    setPw('');
    setConfirmPw('');
    const checkUserSession = async () => {
      if (user && !user.email_confirmed_at) {
        setStep(1);
        setEmail(user.email as string);
      }
    };

    checkUserSession();
  }, []);

  const handleRegister = async () => {
    if (!managerName || !name || !surname) {
      setErrorText('Name Fields required');
      return;
    }
    if (!teamName.trim()) {
      setErrorText('Team name is required');
      return;
    }
    if (!email) {
      setErrorText('Email required');
      return;
    }
    if (!pw) {
      setErrorText('Password required');
      return;
    }
    if (pw.length < 6) {
      setErrorText('Password length must be at least 6.');
      return;
    }
    if (!confirmPw) {
      setErrorText('Confirm Password required');
      return;
    }
    if (pw !== confirmPw) {
      setErrorText('Passwords do not match');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: pw,
        options: {
          data: {
            manager_name: managerName,
            name: name,
            surname: surname,
            team_name: teamName.trim()
          },
          emailRedirectTo: undefined
        }
      });

      console.log("[handleRegister] data", data);

      if (error) {
        console.error("Registration Error:", error.message);
        setErrorText(error.message);
        return;
      }

      if (data.user) {
        if (!data.user.email_confirmed_at) {
          console.log("[handleRegister] Email not confirmed, prompting for code...");
          setStep(1);
          return;
        }

        console.log("[handleRegister] Creating user profile and game data...");
        const setupResult = await userService.handleNewUser(
          data.user.id,
          email,
          teamName.trim()
        );

        if (!setupResult.success) {
          console.error("User setup error:", setupResult.error);
          setErrorText(setupResult.error || 'Failed to set up user profile');
          return;
        }

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email,
          password: pw,
        });

        console.log("[handleRegister] signInData", signInData);

        if (signInError) {
          console.error("Auto-login Error:", signInError.message);
          setErrorText("Registration successful, but auto-login failed. Please try logging in manually.");
        } else {
          console.log("[handleRegister] Registration and setup completed successfully");

          console.log("[handleRegister] Triggering game state refresh...");
          setTimeout(async () => {
            await refreshGameState();
            console.log("[handleRegister] Game state refresh completed");
          }, 1000);

          onClose();
        }
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setErrorText('An unexpected error occurred. Please try again.');
    }
  };

  const handleCode = async () => {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email,
      token: code,
      type: "signup",
    });

    console.log("[handleCode] data", data);

    if (error) {
      console.error("Error verifying OTP:", error);
    } else {
      onClose();
    }
  };

  return (
    <div>
      {step === 0 ? (
        <div className="space-y-4">
          <div className="form-group">
            <label>Manager Name</label>
            <input
              type="text"
              value={managerName}
              placeholder="Manager Name"
              onChange={(e) => {
                setManagerName(e.target.value);
              }}
            />
          </div>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={name}
              placeholder="Name"
              onChange={(e) => {
                setName(e.target.value);
              }}
            />
          </div>
          <div className="form-group">
            <label>Surname</label>
            <input
              type="text"
              value={surname}
              placeholder="Surname"
              onChange={(e) => {
                setSurname(e.target.value);
              }}
            />
          </div>
          <div className="form-group">
            <label>Team Name</label>
            <input
              type="text"
              value={teamName}
              placeholder="Enter your team name"
              onChange={(e) => {
                setTeamName(e.target.value);
              }}
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              placeholder="Email"
              onChange={(e) => {
                setEmail(e.target.value);
              }}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={pw}
              placeholder="Password"
              onChange={(e) => {
                setPw(e.target.value);
              }}
            />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPw}
              placeholder="Confirm Password"
              onChange={(e) => {
                setConfirmPw(e.target.value);
              }}
            />
          </div>
          {errorText && (
            <div className="error text-red-500 text-sm">{errorText}</div>
          )}

          <button className="btn w-full"
            onClick={async () => {
              await handleRegister();
            }}
          >
            Register
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <input
            className="w-full"
            type="text"
            value={code}
            placeholder="VERIFICATION CODE"
            onChange={(e) => {
              setCode(e.target.value);
            }}
          />
          <button className="btn w-full"
            onClick={async () => {
              await handleCode();
            }}
          >
            Confirm Email
          </button>
        </div>
      )}
    </div>
  );
}

export default RegisterModalBody;