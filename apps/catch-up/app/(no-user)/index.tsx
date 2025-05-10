import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { PropsWithChildren, ReactNode } from "react";
import { FC } from "react";
import {
  ButtonProps,
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function NoUserIndexScreen() {
  return (
    <Layout title={<Title>No User</Title>}>
      <Form
        fields={
          <>
            <ThemedTextInput placeholder="Enter your email" />
            <ThemedTextInput placeholder="Enter your password" />
          </>
        }
        actions={
          <>
            <ThemedButton title="Login" />
            <ThemedButton title="Register" />
          </>
        }
      ></Form>
    </Layout>
  );
}

const Layout: FC<PropsWithChildren<{ title: ReactNode }>> = ({
  children,
  title,
}) => {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.container]}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          borderColor: "pink",
          borderStyle: "solid",
          borderWidth: 5,
        }}
      >
        <ThemedView style={styles.titleContainer}>{title}</ThemedView>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

type FormProps = PropsWithChildren<{
  fields: ReactNode;
  actions: ReactNode;
}>;

const Form: FC<FormProps> = ({ children, fields, actions }) => {
  return (
    <ThemedView style={styles.form}>
      <ThemedView style={styles.fields}>{fields}</ThemedView>
      <ThemedView style={styles.actions}>{actions}</ThemedView>
    </ThemedView>
  );
};

const Title: FC<PropsWithChildren> = ({ children }) => {
  return <ThemedText style={styles.title}>{children}</ThemedText>;
};

function ThemedTextInput(props: TextInputProps) {
  const themeColor = useTheme();
  const theme = {
    color: themeColor.text,
    borderColor: themeColor.text,
  };
  return (
    <>
      <TextInput
        style={[styles.input, theme]}
        placeholderTextColor={themeColor.text}
        {...props}
      />
      <ThemedText style={styles.validationStatus}>
        Some validation status
      </ThemedText>
    </>
  );
}

function ThemedButton(props: ButtonProps) {
  const themeColor = useTheme();
  const theme = {
    color: themeColor.text,
    borderColor: themeColor.text,
  };
  return (
    <TouchableOpacity style={[styles.button, theme]} {...props}>
      <ThemedText>{props.title}</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  input: {
    fontSize: 36,
    lineHeight: 48,
    borderWidth: 1,
    borderColor: "black",
  },
  validationStatus: {
    fontSize: 24,
    lineHeight: 36,
  },
  form: {
    flex: 1,
    alignSelf: "stretch",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "green",
    borderStyle: "solid",
  },
  title: {
    lineHeight: 48,
    fontSize: 48,
    fontWeight: "bold",
    textAlign: "center",
  },
  titleContainer: {
    borderWidth: 1,
    borderColor: "blue",
    borderStyle: "solid",
    paddingTop: 72,
    paddingBottom: 64,
  },
  button: {
    borderWidth: 1,
    borderColor: "blue",
    borderStyle: "solid",
    padding: 12,
  },
  fields: {
    gap: 24,
    borderWidth: 1,
    borderColor: "yellow",
    borderStyle: "solid",
  },
  actions: {
    gap: 12,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: "orange",
    borderStyle: "solid",
  },
});
