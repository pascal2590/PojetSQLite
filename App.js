import React, { useState, useEffect } from "react";
import { View, Button, Text, StyleSheet } from "react-native";
import Constants from "expo-constants";
import * as SQLite from "expo-sqlite";
import { ScrollView } from "react-native-gesture-handler";

const db = SQLite.openDatabase("test.db");

export default function App() {
  const [productsList, setProductsList] = React.useState([]);
  const [wishList, setWhishList] = React.useState();
  const [elementsInWishlist, setElementsInWishlist] = React.useState([]);
  const [forcedUpdateId, forceUpdate] = useForceUpdate();

  // Ce code permet d'initialiser les tables au lancement de l'application
  useEffect(() => {
    // Active le mode clé étrangère
    db.exec([{ sql: "PRAGMA foreign_keys = ON;", args: [] }], false, () =>
      console.log("Foreign keys turned on")
    );

    db.transaction(tableCreationTransaction);
  }, []);

  // Récupère via une requete SQL les données quand forceUpdatedId change (déclenché manuellement)
  useEffect(() => {
    db.transaction((tx) => {
      // Récupère la liste des produits
      tx.executeSql("select * from Products", [], (_, result) => {
        setProductsList(result.rows._array);
      });

      // Récupère la liste
      tx.executeSql("select * from WishLists;", [], (_, result) => {
        setWhishList(result.rows._array.pop()); // Get first one
      });

      if (wishList) {
        // Récupère la liste des éléments dans la liste
        tx.executeSql(
          "select * from WhishList_Products W WHERE whishlist_id = ?;",
          [wishList.id],
          (_, result) => {
            setElementsInWishlist(result.rows._array);
          }
        );
      }
    });
  }, [forcedUpdateId, wishList]);


  return (
    <View style={styles.container}>
      <Button
        disabled={!isNil(wishList)}
        title={isNil(wishList) ? "Cliquez pour initialiser" : "Déjà initialisé"}
        onPress={() => {
          db.transaction((t) => {
            // On créé 3 produits
            [1, 2, 3].forEach(
              (el) =>
                t.executeSql(
                  "INSERT INTO Products (title, description, quantity) VALUES (?, ?, ?);",
                  ["Produit" + el, "Description de l'article", 100]
                ),
              () => console.log("Products Created"),
              (e) => console.log("Error on products creation", e)
            );

            // On créé l'utilisateur
            t.executeSql(
              "INSERT INTO Users (first_name, last_name, email) VALUES (?, ?, ?);",
              ["Andréas", "HANSS", "contact@codingspark.io"],
              (result) => {
                console.log("Users Created");
                // Create WhishList for user
                t.executeSql(
                  "INSERT INTO WishLists (owner_id, title, creation_date) VALUES (?, ?, ?);",
                  [1, "La liste d'andréas", Date.now()], // On met 1 en dur car on sait que c'est le premier dans notre cas, sinon il faudrait récupérer la valeur de l'ID
                  () => console.log("Whishlist created"),
                  (e) => console.log("Error on wishlist creation", e)
                );
              },
              (e) => console.log("Error on Users creation", e)
            );

            // Si tout se passe bien, on utilise forceUpdate qui va incrémenter un compteur et donc déclencher notre hook qui va refaire la requete SQL
            forceUpdate();
          });
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {productsList.map((product) => (
          <ObjectLine
            key={product.id}
            title={product.title}
            listId={wishList ? wishList.id : undefined}
            id={product.id}
            isInBucket={elementsInWishlist.find(
              (el) => el.product_id === product.id
            )}
            forceUpdate={forceUpdate}
            description={product.description}
          />
        ))}
      </ScrollView>
      {!isNil(wishList) && (
        <View style={styles.bottomContainer}>
          <Text>Ma liste : {wishList.title}</Text>
          <Text>{JSON.stringify(elementsInWishlist)}</Text>
        </View>
      )}
    </View>
  );
}

const ObjectLine = (props) => {
  return (
    <View style={styles.objectLineStyles}>
      <View>
        <Text>{props.title}</Text>
        <Text>{props.description}</Text>
      </View>
      <View>
        <Button
          disabled={isNil(props.listId)}
          title={props.isInBucket ? "Enlever" : "Ajouter"}
          onPress={() => {
            db.transaction((tx) => {
              // Si l'élément est déjà dans la liste on l'enlève sinon on l'ajoute. Dans tous les cas on déclenche un re-rendu
              props.isInBucket
                ? tx.executeSql(
                    "DELETE FROM WhishList_Products WHERE whishlist_id = ? AND product_id = ?;",
                    [props.listId, props.id],
                    () => {
                      props.forceUpdate();
                    }
                  )
                : tx.executeSql(
                    "INSERT INTO WhishList_Products (whishlist_id, product_id, list_order) VALUES (?, ?, ?);",
                    [props.listId, props.id, randomIntFromInterval(1, 1000)],
                    () => {
                      props.forceUpdate();
                    }
                  );
            });
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Constants.statusBarHeight,
  },
  bottomContainer: {
    height: 100,
    backgroundColor: "lightgrey",
    paddingBottom: Constants.statusBarHeight,
  },
  objectLineStyles: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
});

// Fonction utilitaire qui permet de forcer un re-rendu.
const useForceUpdate = () => {
  const [state, setState] = useState(false);
  return [state, () => setState(prev => prev+1)];
};

const isNil = (value) => typeof value === "undefined" || value === null

const randomIntFromInterval = (min, max) => { // min and max included 
  return Math.floor(Math.random() * (max - min + 1) + min);
}

const tableCreationTransaction  =(t) => {
  t.executeSql(
    "CREATE TABLE IF NOT EXISTS Users (id INTEGER PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE);",
    [],
    () => console.log("Table Users created"),
    (e) => console.warn("Table Users error", e)
  );

  t.executeSql(
    "CREATE TABLE IF NOT EXISTS Products (id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, quantity INTEGER);",
    [],
    () => console.log("Table Products created"),
    (e) => console.warn("Table Products error", e)
  );
  t.executeSql(
    "CREATE TABLE IF NOT EXISTS WishLists (id INTEGER PRIMARY KEY, owner_id INTEGER, title TEXT NOT NULL, creation_date INTEGER NOT NULL, FOREIGN KEY (owner_id) REFERENCES Users (id) ON DELETE CASCADE);",
    [],
    () => console.log("Table WishLists created"),
    (e) => console.warn("Table WishLists error", e)
  );
  t.executeSql(
    "CREATE TABLE IF NOT EXISTS WhishList_Products (whishlist_id INTEGER, product_id INTEGER, list_order INTEGER, PRIMARY KEY (whishlist_id, product_id, list_order), FOREIGN KEY (whishlist_id) REFERENCES WishLists (id) ON DELETE CASCADE, FOREIGN KEY (product_id) REFERENCES Products (id) ON DELETE CASCADE);",
    [],
    () => console.log("Table WhishList_Products created"),
    (e) => console.warn("Table WhishList_Products error", e)
  );
}