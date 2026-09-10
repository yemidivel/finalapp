import React from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { useEffect } from 'react';
import { StoreProvider } from './state/store';

export default function App() {
  useEffect(() => {
    console.log("App component mounted");
  }, []);

  return (
    <StoreProvider>
      <RouterProvider router={router} />
    </StoreProvider>
  );
}
