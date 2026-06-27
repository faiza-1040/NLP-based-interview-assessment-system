// // // src/utils/PrivateRoute.jsx
// // import { Navigate } from 'react-router-dom';

// // const PrivateRoute = ({ children, role }) => {
// //   const token = localStorage.getItem('token');
// //   const userRole = localStorage.getItem('role');
// //   const status = localStorage.getItem('status');
// //   const emailVerified = localStorage.getItem('emailVerified') === 'true';
// //   const onboardingStep = localStorage.getItem('onboardingStep');

// //   if (!token) {
// //     return <Navigate to="/login" replace />;
// //   }

// //   // User has not finished role selection
// //   if (userRole === 'pending' || onboardingStep === 'choose-role') {
// //     return <Navigate to="/choose-role" replace />;
// //   }

// //   // Admin
// //   if (role === 'admin') {
// //     if (userRole !== 'admin') {
// //       return <Navigate to="/login" replace />;
// //     }
// //     return children;
// //   }

// //   // Candidate
// //   if (role === 'candidate') {
// //     if (userRole !== 'candidate') {
// //       return <Navigate to="/login" replace />;
// //     }

// //     if (!emailVerified || status !== 'approved') {
// //       return <Navigate to="/login" replace />;
// //     }

// //     return children;
// //   }

// //   // Recruiter
// //   if (role === 'recruiter') {
// //     if (userRole !== 'recruiter') {
// //       return <Navigate to="/login" replace />;
// //     }

// //     // recruiter can be redirected to special states
// //     if (!emailVerified) {
// //       return <Navigate to="/login" replace />;
// //     }

// //     if (status === 'declined') {
// //       return <Navigate to="/recruiter/declined" replace />;
// //     }

// //     if (status === 'pending') {
// //       return <Navigate to="/recruiter/pending" replace />;
// //     }

// //     if (status !== 'approved') {
// //       return <Navigate to="/login" replace />;
// //     }

// //     return children;
// //   }

// //   return <Navigate to="/login" replace />;
// // };

// // export default PrivateRoute;


// import { Navigate } from 'react-router-dom';

// const PrivateRoute = ({ children, role }) => {
//   const token = localStorage.getItem('token');
//   const userRole = localStorage.getItem('role');
//   const status = localStorage.getItem('status');
//   const emailVerified = localStorage.getItem('emailVerified') === 'true';
//   const onboardingStep = localStorage.getItem('onboardingStep');

//   if (!token) {
//     return <Navigate to="/login" replace />;
//   }

//   if (role === 'admin') {
//     if (userRole !== 'admin') {
//       return <Navigate to="/login" replace />;
//     }
//     return children;
//   }

//   if (userRole === 'pending' || onboardingStep === 'choose-role') {
//     return <Navigate to="/choose-role" replace />;
//   }

//   if (role === 'candidate') {
//     if (userRole !== 'candidate') {
//       return <Navigate to="/login" replace />;
//     }

//     if (!emailVerified || status !== 'approved') {
//       return <Navigate to="/login" replace />;
//     }

//     return children;
//   }

//   if (role === 'recruiter') {
//     if (userRole !== 'recruiter') {
//       return <Navigate to="/login" replace />;
//     }

//     if (!emailVerified) {
//       return <Navigate to="/login" replace />;
//     }

//     if (status === 'declined') {
//       return <Navigate to="/recruiter/declined" replace />;
//     }

//     if (status === 'pending') {
//       return <Navigate to="/recruiter/pending" replace />;
//     }

//     if (status !== 'approved') {
//       return <Navigate to="/login" replace />;
//     }

//     return children;
//   }

//   return <Navigate to="/login" replace />;
// };

// export default PrivateRoute;

// client/src/utils/PrivateRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/authContext';

const PrivateRoute = ({ children, role }) => {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        Checking authentication...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user.role;
  const status = user.status;
  const emailVerified = !!user.emailVerified;
  const onboardingStep = user.onboardingStep;
  console.log("PrivateRoute user:", user);

  if (role === 'admin') {
    if (userRole !== 'admin') {
      return <Navigate to="/login" replace />;
    }
    return children;
  }

  if (userRole === 'pending' || onboardingStep === 'choose-role') {
    return <Navigate to="/choose-role" replace />;
  }

  // if (role === 'candidate') {
  //   if (userRole !== 'candidate') {
  //     return <Navigate to="/login" replace />;
  //   }

  //   if (!emailVerified || status !== 'approved') {
  //     return <Navigate to="/login" replace />;
  //   }

  //   return children;
  // }

  if (role === 'candidate') {
  if (userRole !== 'candidate') {
    return <Navigate to="/login" replace />;
  }

  if (!emailVerified) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

  if (role === 'recruiter') {
    if (userRole !== 'recruiter') {
      return <Navigate to="/login" replace />;
    }

    if (!emailVerified) {
      return <Navigate to="/login" replace />;
    }

    if (status === 'declined') {
      return <Navigate to="/recruiter/declined" replace />;
    }

    if (status === 'pending') {
      return <Navigate to="/recruiter/pending" replace />;
    }

    if (status !== 'approved') {
      return <Navigate to="/login" replace />;
    }

    return children;
  }

  return <Navigate to="/login" replace />;
};

export default PrivateRoute;