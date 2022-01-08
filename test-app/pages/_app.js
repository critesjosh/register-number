import '@celo-tools/use-contractkit/lib/styles.css';
import '../styles/globals.css';

import { Alfajores, ContractKitProvider } from '@celo-tools/use-contractkit';
import { AppProps } from 'next/app';
import { Toaster } from 'react-hot-toast';

function MyApp({ Component, pageProps }) {
  return (
    <ContractKitProvider
      dapp={{
        name: 'Register phone number app',
        description: 'A demo DApp to showcase functionality',
        url: '',
        icon: '',
      }}
      network={Alfajores}
    >
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'w-72 md:w-96',
          style: {
            padding: '0px',
          },
        }}
      />
      <div suppressHydrationWarning>
        {typeof window === 'undefined' ? null : <Component {...pageProps} />}
      </div>
    </ContractKitProvider>
  );
}

export default MyApp
