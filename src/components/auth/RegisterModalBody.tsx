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
    setErrorText('');
    if (!managerName.trim() || !name.trim() || !surname.trim()) {
      setErrorText('All name fields are required.');
      return;
    }
    if (!teamName.trim()) {
      setErrorText('Team name is required.');
      return;
    }
    if (!email.trim()) {
      setErrorText('Email is required.');
      return;
    }
    if (pw.length < 6) {
      setErrorText('Password must be at least 6 characters.');
      return;
    }
    if (pw !== confirmPw) {
      setErrorText('Passwords do not match.');
      return;
    }

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: pw,
        options: {
          data: {
            manager_name: managerName,
            name,
            surname,
            club_name: teamName.trim(),
          },
        },
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }
      const userId = signUpData.user?.id;
      if (!userId) {
        throw new Error('No user ID returned from signUp.');
      }

      const { error: managerError } = await supabase
        .from('club_managers')
        .insert({
          manager_name: managerName.trim(),
          name: name.trim(),
          surname: surname.trim(),
          user_id: userId,
          club_name: teamName.trim(),
        });
      if (managerError) {
        throw new Error(`Club manager insert failed: ${managerError.message}`);
      }

      const setupResult = await userService.handleNewUser(
        userId,
        email.trim(),
        teamName.trim()
      );
      if (!setupResult.success) {
        throw new Error(setupResult.error || 'Failed to set up user profile.');
      }

      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password: pw,
        });
      if (signInError) {
        console.warn('[handleRegister] Auto-login failed:', signInError.message);
        setErrorText(
          'Registration successful, but auto‑login failed. Please log in manually.'
        );
        return;
      }
      console.log('[handleRegister] Auto-login OK:', signInData);

      setTimeout(async () => {
        await refreshGameState();
        console.log('[handleRegister] Game state refreshed');
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('[handleRegister] Error:', err);
      setErrorText(err.message || 'An unexpected error occurred.');
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
            <label>Club Name</label>
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